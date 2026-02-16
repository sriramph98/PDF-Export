/// <reference types="@figma/plugin-typings" />

figma.showUI(__html__, { width: 400, height: 520 });

// ── Types ────────────────────────────────────────

interface FrameData {
  id: string;
  name: string;
}

interface PdfExportSettings {
  colorProfile: "DOCUMENT" | "SRGB" | "DISPLAY_P3_V4";
  preserveMetadata: boolean;
}

let selectedFrames: FrameData[] = [];

// ── Export pipeline ──────────────────────────────

async function exportFrames(
  frames: FrameNode[],
  settings: PdfExportSettings
): Promise<void> {
  const pages: number[][] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    figma.ui.postMessage({
      type: "export-progress",
      current: i,
      total: frames.length,
      frameName: frame.name,
    });

    const pdfBytes = await frame.exportAsync({
      format: "PDF",
      colorProfile: settings.colorProfile,
    });

    pages.push(Array.from(pdfBytes) as number[]);
  }

  figma.ui.postMessage({
    type: "export-progress",
    current: frames.length,
    total: frames.length,
    frameName: "Done",
  });

  const metadata = settings.preserveMetadata
    ? {
        title: figma.root.name,
        creator: "PDF Export: Figma Plugin",
        producer: "pdf-lib",
        creationDate: new Date().toISOString(),
      }
    : null;

  figma.ui.postMessage({
    type: "save-pdf",
    pages,
    metadata,
  });

  figma.notify(
    `Exported ${frames.length} frame(s) to PDF.`
  );
}

// ── Messages ─────────────────────────────────────

figma.ui.onmessage = async (msg: {
  type: string;
  frameId?: string;
  frames?: FrameData[];
  settings?: PdfExportSettings;
}) => {
  if (msg.type === "add-frames") {
    const added = figma.currentPage.selection
      .filter((n): n is FrameNode => n.type === "FRAME")
      .map(
        (f): FrameData => ({ id: f.id, name: f.name || "Unnamed Frame" })
      );

    added.forEach((nf) => {
      if (!selectedFrames.some((f) => f.id === nf.id)) {
        selectedFrames.push(nf);
      }
    });

    figma.ui.postMessage({ type: "update-frames", frames: selectedFrames });
  } else if (msg.type === "remove-frame" && msg.frameId) {
    selectedFrames = selectedFrames.filter((f) => f.id !== msg.frameId);
    figma.ui.postMessage({ type: "update-frames", frames: selectedFrames });
  } else if (msg.type === "export-pdf" && msg.frames && msg.settings) {
    const resolved = msg.frames
      .filter((fd) => selectedFrames.some((s) => s.id === fd.id))
      .map((fd) =>
        figma.currentPage.findOne(
          (n): n is FrameNode => n.type === "FRAME" && n.id === fd.id
        )
      )
      .filter((f): f is FrameNode => f !== null);

    if (resolved.length === 0) {
      figma.notify("No frames to export.");
      figma.ui.postMessage({ type: "export-error" });
      return;
    }

    await exportFrames(resolved, msg.settings);
  } else if (msg.type === "close-plugin") {
    figma.closePlugin();
  }
};
