import json
with open('notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb', 'r') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = cell['source']
        if isinstance(source, list) and any('sns.barplot' in line for line in source):
            if not any('import seaborn as sns' in line for line in source):
                cell['source'] = ['import seaborn as sns\n'] + source
        elif isinstance(source, str) and 'sns.barplot' in source:
            if 'import seaborn as sns' not in source:
                cell['source'] = 'import seaborn as sns\n' + source

with open('notebooks/02_tendencia_regulatoria_414_vs_1000.ipynb', 'w') as f:
    json.dump(nb, f, indent=1)
