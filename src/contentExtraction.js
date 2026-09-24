function extensionOf(name = "") { return name.split(".").pop()?.toLowerCase() || ""; }

export async function extractLectureText(file, fileName = file.name, fileType = file.type) {
  const extension = extensionOf(fileName);
  if (extension === "pdf" || fileType === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n");
  }
  if (extension === "docx") {
    const { default: mammoth } = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (extension === "pptx") {
    const { default: JSZip } = await import("jszip");
    const archive = await JSZip.loadAsync(file);
    const slideNames = Object.keys(archive.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));
    const slides = await Promise.all(slideNames.map(async (name) => {
      const xml = await archive.files[name].async("string");
      const parsed = new DOMParser().parseFromString(xml, "application/xml");
      return Array.from(parsed.getElementsByTagName("a:t"), (node) => node.textContent).join(" ");
    }));
    return slides.join("\n");
  }
  if (extension === "txt" || fileType.startsWith("text/")) return file.text();
  if (extension === "doc" || extension === "ppt") throw new Error("Older .doc and .ppt files are not supported yet. Save them as .docx or .pptx, then upload again.");
  if (fileType.startsWith("video/")) throw new Error("Video audio needs a transcript before questions can be generated. Paste the transcript or captions into the lecture notes field.");
  throw new Error("This file type cannot be read for quiz generation. Add notes or a transcript to the lecture instead.");
}
