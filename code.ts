/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 400, height: 500 });

interface FrameData {
  id: string;
  name: string;
}

let selectedFrames: FrameData[] = []; // Initialize frames array

// Handle messages from the UI
figma.ui.onmessage = async (msg: {
  type: string;
  frameId?: string;
  frames?: FrameData[];
}) => {
  if (msg.type === "add-frames") {
    // Get selected frames in Figma
    const newFrames = figma.currentPage.selection
      .filter((node): node is FrameNode => node.type === "FRAME") // Filter only frames
      .map(
        (frame): FrameData => ({
          id: frame.id,
          name: frame.name || "Unnamed Frame",
        })
      );

    // Prevent duplicates: Only add frames that are not already in the array
    newFrames.forEach((newFrame) => {
      if (
        !selectedFrames.some(
          (existingFrame) => existingFrame.id === newFrame.id
        )
      ) {
        selectedFrames.push(newFrame); // Add new frames
      }
    });

    // Send updated list of frames to the UI
    figma.ui.postMessage({ type: "update-frames", frames: selectedFrames });
  } else if (msg.type === "remove-frame" && msg.frameId) {
    // Remove frame from the `frames` array
    const frameToRemove = msg.frameId;

    // Remove frame from array and ensure proper update
    selectedFrames = selectedFrames.filter(
      (frame) => frame.id !== frameToRemove
    ); // Remove by id

    // Log to check the updated frames array
    console.log("Updated frames after deletion:", selectedFrames);

    // Send updated frames to the UI
    figma.ui.postMessage({ type: "update-frames", frames: selectedFrames });
  } else if (msg.type === "export-pdf" && msg.frames) {
    // Use only the current frames array for export
    const reorderedFrames = msg.frames
      .filter((frame) =>
        selectedFrames.some((existingFrame) => existingFrame.id === frame.id)
      ) // Ensure only present frames are exported
      .map((frame) =>
        figma.currentPage.findOne(
          (node): node is FrameNode =>
            node.type === "FRAME" && node.id === frame.id
        )
      )
      .filter((frame): frame is FrameNode => frame !== null); // Filter out null values

    if (reorderedFrames.length === 0) {
      figma.notify("No frames to export.");
      return;
    }

    const pdfPages: Uint8Array[] = [];
    for (const frame of reorderedFrames) {
      const pdfData = await frame.exportAsync({ format: "PDF" });
      pdfPages.push(pdfData);
    }

    // Send the PDF data to the UI for saving
    figma.ui.postMessage({
      type: "save-pdf",
      data: pdfPages.map((page) => Array.from(page)), // Convert Uint8Array to transferable format
    });

    figma.notify(`Exported ${reorderedFrames.length} frame(s) to PDF.`);
  } else if (msg.type === "close-plugin") {
    figma.closePlugin();
  }
};
