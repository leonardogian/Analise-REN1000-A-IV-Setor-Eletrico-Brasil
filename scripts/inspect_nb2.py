import nbformat

try:
    nb = nbformat.read('notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb', as_version=4)
    for i, cell in enumerate(nb.cells):
        print(f"Cell {i} ({cell.cell_type}): {cell.source[:100].replace('\n', '\\n')}")
except Exception as e:
    print(f"Error: {e}")
