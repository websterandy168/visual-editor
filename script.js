document.addEventListener('DOMContentLoaded', () => {

    const canvas = new fabric.Canvas('editor-canvas', {
        backgroundColor: 'white'
    });

    // All the code for adding text, images, and math is the same...
    const addTextButton = document.getElementById('add-text');
    addTextButton.addEventListener('click', () => {
        const text = prompt('Enter your text:');
        if (text) {
            const textbox = new fabric.Textbox(text, {
                left: 50, top: 50, width: 200, fontSize: 24, fill: '#000000',
                padding: 7, fontFamily: 'Roboto'
            });
            canvas.add(textbox);
            canvas.setActiveObject(textbox);
        }
    });

    const imageLoader = document.getElementById('image-loader');
    imageLoader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (f) => {
            const data = f.target.result;
            fabric.Image.fromURL(data, (img) => {
                img.set({ left: 100, top: 100 });
                img.scaleToWidth(200);
                canvas.add(img);
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });

    const renderLatex = (latexString) => {
        if (!latexString) return;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" />`;
        const mathEl = document.createElement('span');
        tempDiv.appendChild(mathEl);
        try {
            mathEl.style.fontSize = '30px';
            mathEl.style.color = 'black';
            tempDiv.style.padding = '10px';
            katex.render(latexString, mathEl, { throwOnError: true });
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            document.body.appendChild(tempDiv);
            html2canvas(tempDiv, {
                backgroundColor: null,
                scale: 3
            }).then(canvasElement => {
                const dataUrl = canvasElement.toDataURL('image/png');
                fabric.Image.fromURL(dataUrl, (img) => {
                    img.set({ left: 150, top: 150 });
                    img.scaleToWidth(80);
                    canvas.add(img);
                    canvas.setActiveObject(img);
                    canvas.renderAll();
                    document.body.removeChild(tempDiv);
                });
            });
        } catch (error) {
            console.error("KaTeX rendering failed:", error);
            if (tempDiv.parentElement) {
                document.body.removeChild(tempDiv);
            }
            alert(`Failed to render math equation:\n\n${error.message}`);
        }
    };

    const latexButtons = document.querySelectorAll('.latex-btn');
    latexButtons.forEach(button => {
        button.addEventListener('click', () => {
            const template = button.getAttribute('data-template');
            let latexString = '';
            if (template === 'fraction') {
                const num = prompt('Enter numerator:');
                const den = prompt('Enter denominator:');
                if (num !== null && den !== null) {
                    latexString = `\\frac{${num}}{${den}}`;
                }
            } else if (template === 'sqrt') {
                const content = prompt('Enter content of square root:');
                if (content !== null) {
                    latexString = `\\sqrt{${content}}`;
                }
            } else if (template === 'power') {
                const base = prompt('Enter base:');
                const exp = prompt('Enter exponent:');
                if (base !== null && exp !== null) {
                    latexString = `${base}^{${exp}}`;
                }
            } else if (template === 'integral') {
                const from = prompt('Enter the lower limit (from):');
                const to = prompt('Enter the upper limit (to):');
                const func = prompt('Enter the function (e.g., x dx):');
                if (from !== null && to !== null && func !== null) {
                    latexString = `\\int_{${from}}^{${to}} ${func}`;
                }
            }
            renderLatex(latexString);
        });
    });

    // =================================================================
    //  *** THIS IS THE NEW DELETION LOGIC ***
    // =================================================================
    function deleteActiveObject() {
        // Get the currently active object on the canvas
        const activeObject = canvas.getActiveObject();

        if (activeObject) {
            // If it's a group of objects, iterate and remove each one
            if (activeObject.type === 'activeSelection') {
                activeObject.forEachObject(function(obj) {
                    canvas.remove(obj);
                });
            } else {
                // If it's a single object, remove it
                canvas.remove(activeObject);
            }
            // Discard the active selection and redraw the canvas
            canvas.discardActiveObject();
            canvas.renderAll();
        }
    }

    // 1. Logic for the delete button
    const deleteBtn = document.getElementById('delete-btn');
    deleteBtn.addEventListener('click', deleteActiveObject);

    // 2. Logic for the keyboard keys
    window.addEventListener('keydown', function(e) {
        // Check if the pressed key is 'Delete' or 'Backspace'
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Prevent the browser from going back in history on backspace
            e.preventDefault();
            deleteActiveObject();
        }
    });
    // =================================================================

    const exportButton = document.getElementById('export-jpeg');
    exportButton.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL({ format: 'jpeg', quality: 0.9 });
        link.download = 'my-creation.jpeg';
        link.click();
    });
});