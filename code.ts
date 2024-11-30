figma.showUI(__html__, { width: 400, height: 500 });

let frames: { id: string; name: string }[] = []; // Initialize frames array

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'add-frames') {
    // Get selected frames in Figma
    const selectedFrames = figma.currentPage.selection
      .filter((node) => node.type === 'FRAME') // Filter only frames
      .map((frame) => ({
        id: frame.id,
        name: frame.name || 'Unnamed Frame',
      }));

    // Prevent duplicates: Only add frames that are not already in the array
    selectedFrames.forEach((newFrame) => {
      if (!frames.some((existingFrame) => existingFrame.id === newFrame.id)) {
        frames.push(newFrame); // Add new frames
      }
    });

    // Send updated list of frames to the UI
    figma.ui.postMessage({ type: 'update-frames', frames });
  } else if (msg.type === 'remove-frame') {
    // Remove frame from the `frames` array
    const frameToRemove = msg.frameId;

    // Remove frame from array and ensure proper update
    frames = frames.filter((frame) => frame.id !== frameToRemove); // Remove by id

    // Log to check the updated frames array
    console.log("Updated frames after deletion:", frames);

    // Send updated frames to the UI
    figma.ui.postMessage({ type: 'update-frames', frames });
  } else if (msg.type === 'export-pdf') {
    // Use only the current frames array for export
    const reorderedFrames = msg.frames
      .filter((frame) => frames.some((existingFrame) => existingFrame.id === frame.id)) // Ensure only present frames are exported
      .map((frame) => figma.currentPage.findOne((node) => node.id === frame.id))
      .filter(Boolean); // Filter out null values

    if (reorderedFrames.length === 0) {
      figma.notify("No frames to export.");
      return;
    }

    const pdfPages: Uint8Array[] = [];
    for (const frame of reorderedFrames) {
      const pdfData = await frame.exportAsync({ format: 'PDF' });
      pdfPages.push(pdfData);
    }

    // Send the PDF data to the UI for saving
    figma.ui.postMessage({
      type: 'save-pdf',
      data: pdfPages.map((page) => Array.from(page)), // Convert Uint8Array to transferable format
    });

    figma.notify(`Exported ${reorderedFrames.length} frame(s) to PDF.`);
  } else if (msg.type === 'close-plugin') {
    figma.closePlugin();
  }
};