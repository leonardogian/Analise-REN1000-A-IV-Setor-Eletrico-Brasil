import nbformat

nb = nbformat.read('notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb', as_version=4)
for i, cell in enumerate(nb.cells):
    print(f"--- Cell {i} ({cell.cell_type}) ---")
    print(cell.source)
    print("\n")
