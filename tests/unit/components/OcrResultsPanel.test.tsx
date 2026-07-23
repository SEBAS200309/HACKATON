import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import OcrResultsPanel from "@/components/digitization/OcrResultsPanel";
import type { OcrResult, AreaOfInterest } from "@/types";

const mockResults: OcrResult[] = [
  { variableName: "nombre", extractedText: "Juan Pérez", confidence: 95, wordCount: 2 },
  { variableName: "direccion", extractedText: "Calle 123", confidence: 60, wordCount: 2 },
  { variableName: "telefono", extractedText: "", confidence: 0, wordCount: 0 },
];

const mockAreas: AreaOfInterest[] = [
  { id: "a1", x: 0.1, y: 0.1, width: 0.3, height: 0.05, variableName: "nombre", color: "#ef4444" },
  { id: "a2", x: 0.1, y: 0.2, width: 0.3, height: 0.05, variableName: "direccion", color: "#3b82f6" },
  { id: "a3", x: 0.1, y: 0.3, width: 0.3, height: 0.05, variableName: "telefono", color: "#22c55e" },
];

describe("OcrResultsPanel", () => {
  it("renderiza todos los campos de resultado", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    expect(screen.getByText("nombre")).toBeInTheDocument();
    expect(screen.getByText("direccion")).toBeInTheDocument();
    expect(screen.getByText("telefono")).toBeInTheDocument();
  });

  it("muestra porcentaje de confianza por campo", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("muestra conteo de palabras por campo", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    expect(screen.getAllByText("2 palabras")).toHaveLength(2);
    expect(screen.getByText("0 palabras")).toBeInTheDocument();
  });

  it("aplica borde rojo cuando confianza es 0 o texto vacío", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    const telefonoInput = screen.getByLabelText("Texto extraído para telefono");
    expect(telefonoInput.className).toContain("border-red-500");
  });

  it("aplica borde ámbar cuando confianza >0 y <80", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    const direccionInput = screen.getByLabelText("Texto extraído para direccion");
    expect(direccionInput.className).toContain("border-amber-500");
  });

  it("aplica borde normal cuando confianza ≥80", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
      />
    );

    const nombreInput = screen.getByLabelText("Texto extraído para nombre");
    expect(nombreInput.className).toContain("border-gray-600");
  });

  it("llama onFieldEdit al editar un campo", () => {
    const onFieldEdit = vi.fn();
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={onFieldEdit}
        onApprove={vi.fn()}
      />
    );

    const nombreInput = screen.getByLabelText("Texto extraído para nombre");
    fireEvent.change(nombreInput, { target: { value: "Nuevo Valor" } });

    expect(onFieldEdit).toHaveBeenCalledWith("nombre", "Nuevo Valor");
  });

  it("bloquea aprobación si hay campos vacíos y muestra mensaje de error", () => {
    const onApprove = vi.fn();
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={onApprove}
      />
    );

    fireEvent.click(screen.getByText("Aprobar resultados"));

    expect(onApprove).not.toHaveBeenCalled();
    expect(
      screen.getByText("Existen campos vacíos o inválidos. Revise los campos marcados antes de aprobar")
    ).toBeInTheDocument();
  });

  it("llama onApprove cuando todos los campos son válidos", () => {
    const onApprove = vi.fn();
    const validResults: OcrResult[] = [
      { variableName: "nombre", extractedText: "Juan", confidence: 95, wordCount: 1 },
      { variableName: "direccion", extractedText: "Calle 1", confidence: 85, wordCount: 2 },
    ];

    render(
      <OcrResultsPanel
        results={validResults}
        onFieldEdit={vi.fn()}
        onApprove={onApprove}
      />
    );

    fireEvent.click(screen.getByText("Aprobar resultados"));

    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("llama onVariableClick al hacer click en nombre de variable", () => {
    const onVariableClick = vi.fn();
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
        onVariableClick={onVariableClick}
      />
    );

    fireEvent.click(screen.getByLabelText("Seleccionar variable nombre"));

    expect(onVariableClick).toHaveBeenCalledWith("nombre");
  });

  it("resalta la variable seleccionada", () => {
    const { container } = render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
        highlightedVariable="nombre"
      />
    );

    const highlighted = container.querySelector(".ring-2.ring-purple-400");
    expect(highlighted).toBeInTheDocument();
  });

  it("renderiza documento fuente con áreas cuando documentUrl está presente", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
        documentUrl="/test-doc.png"
        areas={mockAreas}
      />
    );

    expect(screen.getByAltText("Documento fuente para OCR")).toBeInTheDocument();
    expect(screen.getByText("Documento fuente")).toBeInTheDocument();
    expect(screen.getByLabelText("Área: nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Área: direccion")).toBeInTheDocument();
  });

  it("resalta el área correspondiente en el documento cuando highlightedVariable coincide", () => {
    render(
      <OcrResultsPanel
        results={mockResults}
        onFieldEdit={vi.fn()}
        onApprove={vi.fn()}
        documentUrl="/test-doc.png"
        areas={mockAreas}
        highlightedVariable="nombre"
      />
    );

    const highlightedArea = screen.getByLabelText("Área: nombre");
    expect(highlightedArea.className).toContain("animate-pulse");
  });
});
