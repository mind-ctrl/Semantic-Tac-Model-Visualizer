import { toPng, toSvg } from "html-to-image";

export async function exportDiagramAsPng(filename: string = "diagram"): Promise<void> {
  const element = document.querySelector(".react-flow") as HTMLElement;
  if (!element) return;

  const theme = document.documentElement.getAttribute("data-theme");
  const bgColor = theme === "light" ? "#f8fafc" : "#0b1121";

  const dataUrl = await toPng(element, { backgroundColor: bgColor });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

export async function exportDiagramAsSvg(filename: string = "diagram"): Promise<void> {
  const element = document.querySelector(".react-flow") as HTMLElement;
  if (!element) return;

  const theme = document.documentElement.getAttribute("data-theme");
  const bgColor = theme === "light" ? "#f8fafc" : "#0b1121";

  const dataUrl = await toSvg(element, { backgroundColor: bgColor });
  const link = document.createElement("a");
  link.download = `${filename}.svg`;
  link.href = dataUrl;
  link.click();
}
