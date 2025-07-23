import { ILesson, IModule } from "./types.mts"

/**
 * Fetches a Jupyter notebook JSON from the given URL,
 * then converts its markdown and code cells into a module with numbered lessons.
 * 
 * @param jupyterNotebookUrl URL to the Jupyter notebook JSON
 * @returns Promise resolving to an array containing a single module
 * @throws Throws errors if fetch fails or data is malformed
 */
export async function runConversionEngine(jupyterNotebookUrl: string): Promise<IModule[]> {
    if (!jupyterNotebookUrl || typeof jupyterNotebookUrl !== 'string') {
        throw new Error('Invalid URL parameter provided to runConversionEngine');
    }

    let notebook;
    try {
        const response = await fetch(jupyterNotebookUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch notebook: HTTP status ${response.status}`);
        }

        notebook = await response.json();

        if (!notebook.cells || !Array.isArray(notebook.cells)) {
            throw new Error('Malformed notebook data: cells property missing or invalid');
        }
    } catch (fetchError) {
        throw fetchError;
    }

    // Attempt to derive module title from notebook metadata or URL filename fallback
    let moduleTitle = 'Imported Module';
    if (notebook.metadata?.title && typeof notebook.metadata.title === 'string') {
        moduleTitle = notebook.metadata.title;
    } else {
        // Try extract filename from URL for module title
        try {
            const urlObj = new URL(jupyterNotebookUrl);
            const pathParts = urlObj.pathname.split('/');
            const filename = pathParts[pathParts.length - 1] || '';
            if (filename.endsWith('.ipynb')) {
                moduleTitle = filename.replace('.ipynb', '');
            }
        } catch {
            // URL parsing failed, keep default title
        }
    }

    const lessons = notebook.cells
        .filter(cell => cell.cell_type === 'markdown' || cell.cell_type === 'code')
        .map((cell, index) => {
            if (!cell.source || !Array.isArray(cell.source)) {
                throw new Error('Invalid cell source data');
            }

            const baseTitle = cell.metadata?.title || 'Untitled Lesson';
            const lessonTitle = `Lesson ${index + 1}: ${baseTitle}`;

            const lesson: ILesson = {
                id: crypto.randomUUID(),
                title: lessonTitle,
                content: cell.source.join(''),
            };

            return lesson;
        });

    const module: IModule = {
        id: crypto.randomUUID(),
        title: moduleTitle,
        lessons,
    };

    return [module];
}
