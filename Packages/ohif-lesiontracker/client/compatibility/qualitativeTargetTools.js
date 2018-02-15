import { OHIF } from 'meteor/ohif:core';
import { Viewerbase } from 'meteor/ohif:viewerbase';
import { cornerstone, cornerstoneMath, cornerstoneTools } from 'meteor/ohif:cornerstone';

const toolDefaultStates = Viewerbase.toolManager.getToolDefaultStates();
const textBoxConfig = toolDefaultStates.textBoxConfig;

var configuration = {
    getMeasurementLocationCallback,
    changeMeasurementLocationCallback,
    drawHandles: false,
    drawHandlesOnHover: true,
    arrowFirst: true,
    textBox: textBoxConfig
};

// Used to cancel tool placement
var keys = {
    ESC: 27
};

// Define a callback to get your text annotation
// This could be used, e.g. to open a modal
function getMeasurementLocationCallback(measurementData, eventData, doneCallback) {
    doneCallback(prompt('Enter your lesion location:'));
}

function changeMeasurementLocationCallback(measurementData, eventData, doneCallback) {
    doneCallback(prompt('Change your lesion location:'));
}


function createQualitativeTargetTool(toolType, responseText='') {
    var toolInterface = {
        toolType: toolType
    };

    var response = responseText;

    /// --- Mouse Tool --- ///
    ///////// BEGIN ACTIVE TOOL ///////
    function addNewMeasurement(mouseEventData) {
        const { element } = mouseEventData;
        const $element = $(element);

        function doneCallback() {
            measurementData.active = true;
            cornerstone.updateImage(element);
        }

        const measurementData = createNewMeasurement(mouseEventData);
        measurementData.viewport = cornerstone.getViewport(element);

        const eventData = { mouseButtonMask: mouseEventData.which };
        const config = cornerstoneTools[toolType].getConfiguration();

        // associate this data with this imageId so we can render it and manipulate it
        cornerstoneTools.addToolState(element, toolType, measurementData);

        const disableDefaultHandlers = () => {
            // since we are dragging to another place to drop the end point, we can just activate
            // the end point and let the moveHandle move it for us.
            $element.off('CornerstoneToolsMouseMove', cornerstoneTools[toolType].mouseMoveCallback);
            $element.off('CornerstoneToolsMouseDown', cornerstoneTools[toolType].mouseDownCallback);
            $element.off('CornerstoneToolsMouseDownActivate', cornerstoneTools[toolType].mouseDownActivateCallback);
            $element.off('CornerstoneToolsMouseDoubleClick', doubleClickCallback);
        };

        disableDefaultHandlers();

        // Add a flag for using Esc to cancel tool placement
        let cancelled = false;
        const cancelAction = () => {
            cancelled = true;
            cornerstoneTools.removeToolState(element, toolType, measurementData);
        };

        // Add a flag for using Esc to cancel tool placement
        const keyDownHandler = event => {
            // If the Esc key was pressed, set the flag to true
            if (event.which === keys.ESC) {
                cancelAction();
            }

            // Don't propagate this keydown event so it can't interfere
            // with anything outside of this tool
            return false;
        };

        // Bind a one-time event listener for the Esc key
        $(element).one('keydown', keyDownHandler);

        // Bind a mousedown handler to cancel the measurement if it's zero-sized
        const mousedownHandler = () => {
            const { start, end } = measurementData.handles;
            if (!cornerstoneMath.point.distance(start, end)) {
                cancelAction();
            }
        };

        // Bind a one-time event listener for mouse down
        $element.one('mousedown', mousedownHandler);

        // Keep the current image and create a handler for new rendered images
        const currentImage = cornerstone.getImage(element);
        const currentViewport = cornerstone.getViewport(element);
        const imageRenderedHandler = () => {
            const newImage = cornerstone.getImage(element);

            // Check if the rendered image changed during measurement creation and delete it if so
            if (newImage.imageId !== currentImage.imageId) {
                cornerstone.displayImage(element, currentImage, currentViewport);
                cancelAction();
                cornerstone.displayImage(element, newImage, currentViewport);
            }
        };

        // Bind the event listener for image rendering
        $element.on('cornerstoneimagerendered', imageRenderedHandler);

        // Bind the tool deactivation and enlargement handlers
        $element.on('CornerstoneToolsToolDeactivated', cancelAction);
        $element.one('ohif.viewer.viewport.toggleEnlargement', cancelAction);

        cornerstone.updateImage(element);

        cornerstoneTools.moveNewHandle(mouseEventData, toolType, measurementData, measurementData.handles.end, function() {
            if (cancelled || cornerstoneTools.anyHandlesOutsideImage(mouseEventData, measurementData.handles)) {
                // delete the measurement
                cornerstoneTools.removeToolState(mouseEventData.element, toolType, measurementData);
            } else {
                config.getMeasurementLocationCallback(measurementData, mouseEventData, doneCallback);
            }

            // Unbind the Esc keydown hook
            $element.off('keydown', keyDownHandler);

            // Unbind the mouse down hook
            $element.off('mousedown', mousedownHandler);

            // Unbind the event listener for image rendering
            $element.off('cornerstoneimagerendered', imageRenderedHandler);

            // Unbind the tool deactivation and enlargement handlers
            $element.off('CornerstoneToolsToolDeactivated', cancelAction);
            $element.off('ohif.viewer.viewport.toggleEnlargement', cancelAction);

            // Disable the default handlers and re-enable again
            disableDefaultHandlers();
            $element.on('CornerstoneToolsMouseMove', eventData, cornerstoneTools[toolType].mouseMoveCallback);
            $element.on('CornerstoneToolsMouseDown', eventData, cornerstoneTools[toolType].mouseDownCallback);
            $element.on('CornerstoneToolsMouseDownActivate', eventData, cornerstoneTools[toolType].mouseDownActivateCallback);
            $element.on('CornerstoneToolsMouseDoubleClick', eventData, doubleClickCallback);

            cornerstone.updateImage(element);
        });
    }

    function createNewMeasurement(mouseEventData) {
        var imageId = mouseEventData.image.imageId;

        // Get studyInstanceUid
        var study = cornerstone.metaData.get('study', imageId);
        var studyInstanceUid = study.studyInstanceUid;
        var patientId = study.patientId;

        // Get seriesInstanceUid
        var series = cornerstone.metaData.get('series', imageId);
        var seriesInstanceUid = series.seriesInstanceUid;

        // create the measurement data for this tool with the end handle activated
        var measurementData = {
            isCreating: true,
            visible: true,
            active: true,
            handles: {
                start: {
                    x: mouseEventData.currentPoints.image.x,
                    y: mouseEventData.currentPoints.image.y,
                    allowedOutsideImage: true,
                    highlight: true,
                    active: false
                },
                end: {
                    x: mouseEventData.currentPoints.image.x,
                    y: mouseEventData.currentPoints.image.y,
                    allowedOutsideImage: true,
                    highlight: true,
                    active: false
                },
                textBox: {
                    x: mouseEventData.currentPoints.image.x - 50,
                    y: mouseEventData.currentPoints.image.y - 50,
                    active: false,
                    movesIndependently: false,
                    drawnIndependently: true,
                    allowedOutsideImage: true,
                    hasBoundingBox: true
                }
            },
            imageId: imageId,
            seriesInstanceUid: seriesInstanceUid,
            studyInstanceUid: studyInstanceUid,
            patientId: patientId,
            response: response,
            isTarget: true,
            toolType: toolType
        };

        return measurementData;
    }
    ///////// END ACTIVE TOOL ///////

    function pointNearTool(element, data, coords) {
        var lineSegment = {
            start: cornerstone.pixelToCanvas(element, data.handles.start),
            end: cornerstone.pixelToCanvas(element, data.handles.end)
        };
        var distanceToPoint = cornerstoneMath.lineSegment.distanceToPoint(lineSegment, coords);

        if (cornerstoneTools.pointInsideBoundingBox(data.handles.textBox, coords)) {
            return true;
        }

        return distanceToPoint < 25;
    }

    function drawDottedArrow(context, start, end, color, lineWidth) {
        //variables to be used when creating the arrow
        var headLength = 10;

        var angle = Math.atan2(end.y - start.y, end.x - start.x);

        //starting path of the arrow from the start square to the end square and drawing the stroke
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        //context.setLineDash([ 2, 3 ]);
        context.stroke();

        //starting a new path from the head of the arrow to one of the sides of the point
        context.beginPath();
        context.moveTo(end.x, end.y);
        context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 7), end.y - headLength * Math.sin(angle - Math.PI / 7));

        //path from the side point of the arrow, to the other side point
        context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 7), end.y - headLength * Math.sin(angle + Math.PI / 7));

        //path from the side point back to the tip of the arrow, and then again to the opposite side point
        context.lineTo(end.x, end.y);
        context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 7), end.y - headLength * Math.sin(angle - Math.PI / 7));

        //draws the paths created above
        context.strokeStyle = color;
        context.lineWidth = lineWidth;
        context.stroke();
        context.fillStyle = color;
        context.fill();
    }

    ///////// BEGIN IMAGE RENDERING ///////
    function onImageRendered(e) {
        const eventData = e.detail;
        var element = eventData.element;

        // if we have no toolData for this element, return immediately as there is nothing to do
        var toolData = cornerstoneTools.getToolState(element, toolType);
        if (!toolData) {
            return;
        }

        // we have tool data for this element - iterate over each one and draw it
        var context = eventData.canvasContext.canvas.getContext('2d');
        context.setTransform(1, 0, 0, 1, 0, 0);

        var color;
        var lineWidth = cornerstoneTools.toolStyle.getToolWidth();
        var config = cornerstoneTools[toolType].getConfiguration();

        for (var i = 0; i < toolData.data.length; i++) {
            var data = toolData.data[i];

            context.save();

            // configurable shadow from CornerstoneTools
            if (config && config.shadow) {
                context.shadowColor = config.shadowColor || '#000000';
                context.shadowOffsetX = config.shadowOffsetX || 1;
                context.shadowOffsetY = config.shadowOffsetY || 1;
            }

            if (data.active) {
                color = cornerstoneTools.toolColors.getActiveColor();
            } else {
                color = cornerstoneTools.toolColors.getToolColor();
            }

            // Draw the arrow
            var handleStartCanvas = cornerstone.pixelToCanvas(element, data.handles.start);
            var handleEndCanvas = cornerstone.pixelToCanvas(element, data.handles.end);
            var canvasTextLocation = cornerstone.pixelToCanvas(element, data.handles.textBox);

            drawDottedArrow(context, handleEndCanvas, handleStartCanvas, color, lineWidth);

            if (config.drawHandles) {
                cornerstoneTools.drawHandles(context, eventData, data.handles, color);
            } else if (config.drawHandlesOnHover && data.handles.start.active) {
                cornerstoneTools.drawHandles(context, eventData, [data.handles.start], color);
            } else if (config.drawHandlesOnHover && data.handles.end.active) {
                cornerstoneTools.drawHandles(context, eventData, [data.handles.end], color);
            }

            // Draw the text
            if (data.measurementNumber) {
                var textLines = [`Target ${data.measurementNumber}`, response];

                var boundingBox = cornerstoneTools.drawTextBox(
                    context,
                    textLines,
                    canvasTextLocation.x,
                    canvasTextLocation.y,
                    color,
                    config.textBox
                );

                data.handles.textBox.boundingBox = boundingBox;

                OHIF.cornerstone.repositionTextBox(eventData, data, config.textBox);

                // Draw linked line as dashed
                var link = {
                    start: {},
                    end: {}
                };

                var midpointCanvas = {
                    x: (handleStartCanvas.x + handleEndCanvas.x) / 2,
                    y: (handleStartCanvas.y + handleEndCanvas.y) / 2,
                };

                var points = [ handleStartCanvas, handleEndCanvas, midpointCanvas ];

                link.end.x = canvasTextLocation.x;
                link.end.y = canvasTextLocation.y;

                link.start = cornerstoneMath.point.findClosestPoint(points, link.end);

                var boundingBoxPoints = [ {
                        // Top middle point of bounding box
                        x: boundingBox.left + boundingBox.width / 2,
                        y: boundingBox.top
                    }, {
                        // Left middle point of bounding box
                        x: boundingBox.left,
                        y: boundingBox.top + boundingBox.height / 2
                    }, {
                        // Bottom middle point of bounding box
                        x: boundingBox.left + boundingBox.width / 2,
                        y: boundingBox.top + boundingBox.height
                    }, {
                        // Right middle point of bounding box
                        x: boundingBox.left + boundingBox.width,
                        y: boundingBox.top + boundingBox.height / 2
                    },
                ];

                link.end = cornerstoneMath.point.findClosestPoint(boundingBoxPoints, link.start);
                context.beginPath();
                context.strokeStyle = color;
                context.lineWidth = lineWidth;
                context.setLineDash([ 2, 3 ]);

                context.moveTo(link.start.x, link.start.y);
                context.lineTo(link.end.x, link.end.y);
                context.stroke();
            }

            context.restore();
        }
    }

    // ---- Touch tool ----

    ///////// BEGIN ACTIVE TOOL ///////
    function addNewMeasurementTouch(touchEventData) {
        var element = touchEventData.element;

        function doneCallback() {
            measurementData.active = true;
            cornerstone.updateImage(element);
        }

        var measurementData = createNewMeasurement(touchEventData);
        cornerstoneTools.addToolState(element, toolType, measurementData);
        $(element).off('CornerstoneToolsTouchDrag', cornerstoneTools[toolType + "Touch"].touchMoveHandle);
        $(element).off('CornerstoneToolsDragStartActive', cornerstoneTools[toolType + "Touch"].touchDownActivateCallback);
        $(element).off('CornerstoneToolsTap', cornerstoneTools[toolType + "Touch"].tapCallback);
        var config = cornerstoneTools[toolType].getConfiguration();

        cornerstone.updateImage(element);

        cornerstoneTools.moveNewHandleTouch(touchEventData, toolType, measurementData, measurementData.handles.end, function() {
            cornerstone.updateImage(element);

            if (cornerstoneTools.anyHandlesOutsideImage(touchEventData, measurementData.handles)) {
                // delete the measurement
                cornerstoneTools.removeToolState(element, toolType, measurementData);
            }

            config.getMeasurementLocationCallback(measurementData, touchEventData, doneCallback);

            $(element).on('CornerstoneToolsTouchDrag', cornerstoneTools[toolType + "Touch"].touchMoveHandle);
            $(element).on('CornerstoneToolsDragStartActive', cornerstoneTools[toolType + "Touch"].touchDownActivateCallback);
            $(element).on('CornerstoneToolsTap', cornerstoneTools[toolType + "Touch"].tapCallback);
        });
    }

    function doubleClickCallback(e) {
        const eventData = e.detail;
        var element = eventData.element;
        var data;

        function doneCallback(data, deleteTool) {
            if (deleteTool === true) {
                cornerstoneTools.removeToolState(element, toolType, data);
                cornerstone.updateImage(element);
                return;
            }

            data.active = false;
            cornerstone.updateImage(element);
        }

        if (e.data && e.data.mouseButtonMask && !cornerstoneTools.isMouseButtonEnabled(eventData.which, e.data.mouseButtonMask)) {
            return false;
        }

        var config = cornerstoneTools[toolType].getConfiguration();

        var coords = eventData.currentPoints.canvas;
        var toolData = cornerstoneTools.getToolState(element, toolType);

        // now check to see if there is a handle we can move
        if (!toolData) {
            return;
        }

        for (var i = 0; i < toolData.data.length; i++) {
            data = toolData.data[i];
            if (pointNearTool(element, data, coords)) {
                data.active = true;
                cornerstone.updateImage(element);
                // Allow relabelling via a callback
                config.changeMeasurementLocationCallback(data, eventData, doneCallback);

                e.stopImmediatePropagation();
                return false;
            }
        }
    }


    toolInterface.mouse = cornerstoneTools.mouseButtonTool({
        addNewMeasurement: addNewMeasurement,
        createNewMeasurement: createNewMeasurement,
        onImageRendered: onImageRendered,
        pointNearTool: pointNearTool,
        toolType: toolType,
        mouseDoubleClickCallback: doubleClickCallback
    });

    toolInterface.touch = cornerstoneTools.touchTool({
        addNewMeasurement: addNewMeasurementTouch,
        createNewMeasurement: createNewMeasurement,
        onImageRendered: onImageRendered,
        pointNearTool: pointNearTool,
        toolType: toolType
        // pressCallback: doubleClickCallback
    });

    return toolInterface;
}

var targetCRInterface = createQualitativeTargetTool('targetCR', 'CR');
cornerstoneTools.targetCR = targetCRInterface.mouse;
cornerstoneTools.targetCR.setConfiguration(configuration);
cornerstoneTools.targetCRTouch = targetCRInterface.touch;

var targetUNInterface = createQualitativeTargetTool('targetUN', 'UN');
cornerstoneTools.targetUN = targetUNInterface.mouse;
cornerstoneTools.targetUN.setConfiguration(configuration);
cornerstoneTools.targetUNTouch = targetUNInterface.touch;

OHIF.lesiontracker.createQualitativeTargetTool = createQualitativeTargetTool;
