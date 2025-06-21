document.addEventListener('DOMContentLoaded', () => {

    const canvas = new fabric.Canvas('editor-canvas', {
        backgroundColor: 'white'
    });

    let isTextEditing = false;
    let isDimensionMode = false;
    let dimensionStartPoint = null;
    let tempLine = null;
    let isPolygonMode = false;
    let polygonPoints = [];
    let tempPolygonLines = [];
    let tempFollowLine = null;

    const propertiesPanel = document.getElementById('properties-panel');
    const propertiesContent = document.getElementById('properties-content');
    let infoBox = null;

    canvas.on('text:editing:entered', () => {
        isTextEditing = true;
    });
    canvas.on('text:editing:exited', () => {
        isTextEditing = false;
        canvas.renderAll(); // Re-render to show selection handles if needed
    });

    // Create and append the info box for real-time drawing feedback
    infoBox = document.createElement('div');
    infoBox.className = 'info-box';
    document.body.appendChild(infoBox);

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
    
    function createTapeDiagram(segments) {
        const boxWidth = 80;
        const boxHeight = 60;
        const strokeColor = '#333';
        const fillColor = 'rgba(255, 255, 255, 0)';
        const strokeWidth = 2;
        const diagramParts = [];
        for (let i = 0; i < segments; i++) {
            const box = new fabric.Rect({
                left: i * boxWidth,
                top: 0,
                width: boxWidth,
                height: boxHeight,
                fill: fillColor,
                stroke: strokeColor,
                strokeWidth: strokeWidth
            });
            diagramParts.push(box);
        }
        const tapeDiagram = new fabric.Group(diagramParts, {
            left: 150,
            top: 150,
            lockScalingFlip: true,
        });
        canvas.add(tapeDiagram);
        canvas.setActiveObject(tapeDiagram);
        canvas.renderAll();
    }

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

    function resetPolygonMode() {
        // Remove all temporary visual guides
        tempPolygonLines.forEach(line => canvas.remove(line));
        if (tempFollowLine) {
            canvas.remove(tempFollowLine);
        }
        
        // Reset state variables
        isPolygonMode = false;
        polygonPoints = [];
        tempPolygonLines = [];
        tempFollowLine = null;

        // Reset canvas to default state
        canvas.defaultCursor = 'default';
        canvas.selection = true;
        canvas.forEachObject(obj => obj.set('selectable', true));

        // Hide the info box
        if (infoBox) infoBox.style.display = 'none';
        canvas.renderAll();
    }

    function createPolygonFromPoints() {
        // Remove temporary lines and circle before creating the final polygon
        if (polygonPoints.length < 3) {
            resetPolygonMode(); // Not a valid polygon, just cancel
            return;
        }

        const polygon = new fabric.Polygon(polygonPoints, {
            fill: 'rgba(173, 216, 230, 0.5)', // Light blue, semi-transparent
            stroke: '#333',
            strokeWidth: 2,
            lockScalingFlip: true,
        });

        canvas.add(polygon);
        canvas.setActiveObject(polygon);
        // Call resetPolygonMode to clean up temp lines AND the info box
        resetPolygonMode();
    }

    function addPolygonPoint(point) {
        // Check for closing the polygon
        if (polygonPoints.length > 2) {
            const firstPoint = polygonPoints[0];
            const distance = Math.sqrt(Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.y - firstPoint.y, 2));
            if (distance < 10) {
                createPolygonFromPoints();
                return;
            }
        }

        polygonPoints.push(point);

        if (polygonPoints.length > 1) {
            const start = polygonPoints[polygonPoints.length - 2];
            const end = polygonPoints[polygonPoints.length - 1];
            const line = new fabric.Line([start.x, start.y, end.x, end.y], {
                stroke: '#aaa', strokeWidth: 2, selectable: false, evented: false,
            });
            tempPolygonLines.push(line);
            canvas.add(line);
        }

        if (polygonPoints.length === 1) {
            const startCircle = new fabric.Circle({
                radius: 5, fill: 'rgba(100,100,255,0.5)', left: point.x, top: point.y,
                originX: 'center', originY: 'center', selectable: false, evented: false,
            });
            tempPolygonLines.push(startCircle);
            canvas.add(startCircle);
        }
        canvas.renderAll();
    }

    function addPreciseSegment() {
        if (!isPolygonMode || polygonPoints.length < 1) return;
        const input = prompt("Enter length and angle (e.g., 100, 45):");
        if (input === null) return; // User cancelled

        const parts = input.split(',').map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const [length, angleDeg] = parts;
            const angleRad = fabric.util.degreesToRadians(angleDeg);
            const lastPoint = polygonPoints[polygonPoints.length - 1];
            // Calculate next point based on math angle (0=right, 90=up), inverting Y for screen coordinates
            const nextPoint = { x: lastPoint.x + length * Math.cos(angleRad), y: lastPoint.y - length * Math.sin(angleRad) };
            addPolygonPoint(nextPoint);
        } else { alert("Invalid format. Please use 'length, angle'."); }
    }

    function getAbsolutePoints(polygon) {
        const matrix = polygon.calcTransformMatrix();
        return polygon.points.map(p => fabric.util.transformPoint(p, matrix));
    }

    function hidePropertiesPanel() {
        propertiesPanel.classList.add('hidden');
        propertiesContent.innerHTML = '';
    }

    function updatePropertiesPanel(e) {
        const activeObject = e.target;
        // Only show for single selected polygons
        if (activeObject && activeObject.type === 'polygon' && !activeObject.group) {
            populatePolygonProperties(activeObject);
            propertiesPanel.classList.remove('hidden');
        } else {
            hidePropertiesPanel();
        }
    }

    function populatePolygonProperties(polygon) {
        propertiesContent.innerHTML = '';
        // The content is cleared. This panel can be used for other properties
        // like fill/stroke color in the future.
    }

    canvas.on({
        'selection:created': updatePropertiesPanel,
        'selection:updated': updatePropertiesPanel,
        'selection:cleared': hidePropertiesPanel,
    });

    const tapeDiagramBtn = document.getElementById('tape-diagram-btn');
    tapeDiagramBtn.addEventListener('click', () => {
        const segments = prompt('How many segments for the tape diagram?');
        if (segments) {
            const numSegments = parseInt(segments, 10);
            if (!isNaN(numSegments) && numSegments > 0) {
                createTapeDiagram(numSegments);
            } else {
                alert('Please enter a valid number greater than 0.');
            }
        }
    });

    function createDimension(start, end, labelText) {
        const line = new fabric.Line([start.x, start.y, end.x, end.y], {
            stroke: '#333',
            strokeWidth: 2,
        });

        const tickSize = 10; // Length of the perpendicular tick
        const angle = Math.atan2(end.y - start.y, end.x - start.x); // Angle of the main dimension line in radians
        const angleDeg = fabric.util.radiansToDegrees(angle); // Angle in degrees for the label

        // Calculate points for the perpendicular ticks
        // The angle perpendicular to the main line
        const perpAngle = angle + Math.PI / 2; 

        // For tick1 at 'start' point
        const tick1_x1 = start.x + (tickSize / 2) * Math.cos(perpAngle);
        const tick1_y1 = start.y + (tickSize / 2) * Math.sin(perpAngle);
        const tick1_x2 = start.x - (tickSize / 2) * Math.cos(perpAngle);
        const tick1_y2 = start.y - (tickSize / 2) * Math.sin(perpAngle);

        const tick1 = new fabric.Line([tick1_x1, tick1_y1, tick1_x2, tick1_y2], {
            stroke: '#333',
            strokeWidth: 2,
        });

        // For tick2 at 'end' point
        const tick2_x1 = end.x + (tickSize / 2) * Math.cos(perpAngle);
        const tick2_y1 = end.y + (tickSize / 2) * Math.sin(perpAngle);
        const tick2_x2 = end.x - (tickSize / 2) * Math.cos(perpAngle);
        const tick2_y2 = end.y - (tickSize / 2) * Math.sin(perpAngle);

        const tick2 = new fabric.Line([tick2_x1, tick2_y1, tick2_x2, tick2_y2], {
            stroke: '#333',
            strokeWidth: 2,
        });

        // Position the label above the center of the line
        const textOffset = 15;
        const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

        // Calculate offset perpendicular to the line
        const offsetX = textOffset * Math.sin(angle);
        const offsetY = textOffset * Math.cos(angle);

        const label = new fabric.Textbox(labelText, {
            left: midPoint.x - offsetX,
            top: midPoint.y + offsetY,
            fontSize: 18,
            fill: '#000000',
            fontFamily: 'Roboto',
            textAlign: 'center',
            originX: 'center',
            originY: 'center', // Keep origin for text rotation
            angle: angleDeg,
            width: labelText.length * 12, // Give it an initial sensible width
        });

        // If the text is upside down, flip it for readability
        if (angleDeg > 90 || angleDeg < -90) {
            label.set({
                angle: angleDeg + 180,
                left: midPoint.x + offsetX,
                top: midPoint.y - offsetY,
            });
        }

        const dimensionGroup = new fabric.Group([line, tick1, tick2, label], {
            lockScalingFlip: true,
            subTargetCheck: true, // Allows editing text within the group
        });

        canvas.add(dimensionGroup);
        canvas.setActiveObject(dimensionGroup);
    }

    const addDimensionBtn = document.getElementById('add-dimension-btn');
    addDimensionBtn.addEventListener('click', () => {
        isDimensionMode = true;
        canvas.defaultCursor = 'crosshair';
        canvas.selection = false; // Disable object selection
        canvas.forEachObject(obj => obj.set('selectable', false));
        canvas.renderAll();
    });

    const addPolygonBtn = document.getElementById('add-polygon-btn');
    addPolygonBtn.addEventListener('click', () => {
        isPolygonMode = true;
        canvas.defaultCursor = 'crosshair';
        canvas.selection = false;
        canvas.forEachObject(obj => obj.set('selectable', false));
        canvas.renderAll();
    });
    
    canvas.on('mouse:down', (o) => {
        const pointer = canvas.getPointer(o.e);

        if (isDimensionMode) {
            if (!dimensionStartPoint) {
            dimensionStartPoint = { x: pointer.x, y: pointer.y };
            tempLine = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                stroke: '#aaa', strokeWidth: 2, strokeDashArray: [5, 5]
            });
            canvas.add(tempLine);
        } else {
            // Second click: create the dimension object
            const label = prompt('Enter label for the dimension:');
            const endPoint = { x: pointer.x, y: dimensionStartPoint.y };
            if (label !== null) { // Only create if user doesn't cancel
                createDimension(dimensionStartPoint, endPoint, label);
            }
            // Cleanup and exit dimension mode
            canvas.remove(tempLine);
            tempLine = null;
            dimensionStartPoint = null;
            isDimensionMode = false;
            canvas.defaultCursor = 'default';
            canvas.selection = true;
            canvas.forEachObject(obj => obj.set('selectable', true));
            canvas.renderAll();
        }
        } else if (isPolygonMode) {
            addPolygonPoint({ x: pointer.x, y: pointer.y });
        }
    });

    canvas.on('mouse:move', (o) => {
        const pointer = canvas.getPointer(o.e);
        if (isDimensionMode && dimensionStartPoint && tempLine) {
            tempLine.set({ x2: pointer.x, y2: dimensionStartPoint.y });
            canvas.renderAll();
        } else if (isPolygonMode && polygonPoints.length > 0) {
            const lastPoint = polygonPoints[polygonPoints.length - 1];
            if (tempFollowLine) canvas.remove(tempFollowLine);
            tempFollowLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], { stroke: '#aaa', strokeWidth: 2, strokeDashArray: [5, 5], selectable: false, evented: false });
            canvas.add(tempFollowLine);

            // --- NEW INFO BOX LOGIC ---
            // 1. Calculate length
            const length = Math.sqrt(Math.pow(pointer.x - lastPoint.x, 2) + Math.pow(pointer.y - lastPoint.y, 2));

            // 2. Calculate horizontal angle (adjusting for screen coordinates where Y is inverted)
            const horizontalAngleRad = Math.atan2(-(pointer.y - lastPoint.y), pointer.x - lastPoint.x);
            let horizontalAngleDeg = fabric.util.radiansToDegrees(horizontalAngleRad);
            if (horizontalAngleDeg < 0) horizontalAngleDeg += 360; // Normalize to 0-360

            let infoText = `L: ${length.toFixed(1)}<br>Abs ∠: ${horizontalAngleDeg.toFixed(1)}°`;

            // 3. Calculate relative angle if there's a previous segment
            if (polygonPoints.length > 1) {
                const prevPoint = polygonPoints[polygonPoints.length - 2];
                const v1 = { x: prevPoint.x - lastPoint.x, y: prevPoint.y - lastPoint.y };
                const v2 = { x: pointer.x - lastPoint.x, y: pointer.y - lastPoint.y };

                const dotProduct = v1.x * v2.x + v1.y * v2.y;
                const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
                
                if (mag1 > 0 && mag2 > 0) {
                    const cosAngle = dotProduct / (mag1 * mag2);
                    const clampedCos = Math.max(-1, Math.min(1, cosAngle)); // Clamp to avoid floating point errors with acos
                    const relativeAngleRad = Math.acos(clampedCos);
                    const relativeAngleDeg = fabric.util.radiansToDegrees(relativeAngleRad);
                    infoText += `<br>Rel ∠: ${relativeAngleDeg.toFixed(1)}°`;
                }
            }

            infoText += `<br>---<br>Tab for precise input`;

            infoBox.innerHTML = infoText;
            infoBox.style.display = 'block';
            infoBox.style.left = `${o.e.clientX + 15}px`;
            infoBox.style.top = `${o.e.clientY + 15}px`;

            canvas.renderAll();
        } else {
            if (infoBox) infoBox.style.display = 'none';
        }
    });

    window.addEventListener('keydown', function(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (isTextEditing) {
                return;
            }
            e.preventDefault();
            deleteActiveObject();
        } else if (isPolygonMode) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (polygonPoints.length >= 3) createPolygonFromPoints();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                resetPolygonMode();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                // Hide the info box while the prompt is open to prevent overlap
                if (infoBox) infoBox.style.display = 'none';
                addPreciseSegment();
            }
        }
    });

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

    function deleteActiveObject() {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            if (activeObject.type === 'activeSelection') {
                activeObject.forEachObject(function(obj) {
                    canvas.remove(obj);
                });
            } else {
                canvas.remove(activeObject);
            }
            canvas.discardActiveObject();
            canvas.renderAll();
        }
    }

    const deleteBtn = document.getElementById('delete-btn');
    deleteBtn.addEventListener('click', deleteActiveObject);

    const exportButton = document.getElementById('export-jpeg');
    exportButton.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = canvas.toDataURL({ format: 'jpeg', quality: 0.9 });
        link.download = 'my-creation.jpeg';
        link.click();
    });
});