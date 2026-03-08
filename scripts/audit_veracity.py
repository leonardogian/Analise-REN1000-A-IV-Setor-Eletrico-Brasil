import csv
import pandas as pd
from pathlib import Path

# Paths
ROOT = Path("/home/gianmarinolc/Documents/Estudos/TCC_leo_main")
DIR_RAW = ROOT / "data" / "raw"
DIR_PROCEP = ROOT / "data" / "processed"

print("="*60)
print("🔍 AUDITORIA DE FIDELIDADE DOS DADOS (RAW vs PROCESSED)")
print("="*60)

def parse_br_num_lenient(v):
    if not v: return 0.0
    s = str(v).strip().replace(".", "").replace(",", ".")
    try:
        return float(s)
    except:
        return 0.0

print("\n[1] INDGER - Serviços Comerciais")
raw_files = list(set(list(DIR_RAW.glob("*servico*comercia*.csv")) + list(DIR_RAW.rglob("*servico*comercia*.csv"))))

raw_comp = 0.0
raw_fora_prazo = 0.0
raw_serv_realizados = 0.0

for f in raw_files:
    print(f"  Lendo: Lendo {f.name}...")
    encodings = ["utf-8", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            with open(f, "r", encoding=enc) as cf:
                reader = csv.DictReader(cf, delimiter=";")
                # lower case fieldnames
                if reader.fieldnames:
                    reader.fieldnames = [n.strip().lower() for n in reader.fieldnames]
                
                if "vlrpagocompensacao" not in reader.fieldnames:
                    continue
                
                for row in reader:
                    raw_comp += parse_br_num_lenient(row.get("vlrpagocompensacao", 0))
                    raw_fora_prazo += parse_br_num_lenient(row.get("qtdservrealizdescprazo", 0))
                    raw_serv_realizados += parse_br_num_lenient(row.get("qtdservrealizado", 0))
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f"Error {e}")
            break

print(f"  RAW - Soma Vlr Pago Compensação: R$ {raw_comp:,.2f}")
print(f"  RAW - Soma Qtd Fora do Prazo:      {raw_fora_prazo:,.0f}")
print(f"  RAW - Soma Qtd Serv Realizado:     {raw_serv_realizados:,.0f}")

# Processed
try:
    df_proc = pd.read_parquet(DIR_PROCEP / "indger_servicos_comerciais.parquet")
    proc_comp = df_proc["vlrpagocompensacao"].apply(parse_br_num_lenient).sum()
    proc_fora_prazo = df_proc["qtdservrealizdescprazo"].apply(parse_br_num_lenient).sum()
    proc_serv_realizados = df_proc["qtdservrealizado"].apply(parse_br_num_lenient).sum()
    
    print(f"  PROC - Soma Vlr Pago Compensação: R$ {proc_comp:,.2f}")
    print(f"  PROC - Soma Qtd Fora do Prazo:      {proc_fora_prazo:,.0f}")
    print(f"  PROC - Soma Qtd Serv Realizado:     {proc_serv_realizados:,.0f}")
except Exception as e:
    print(f"  PROC - Arquivo transform não encontrado: {e}")

# Analysis layer
try:
    df_ana = pd.read_parquet(DIR_PROCEP / "analysis" / "fato_servicos_municipio_mes.parquet")
    ana_comp = df_ana["compensacao_rs"].sum()
    ana_fora_prazo = df_ana["qtd_fora_prazo"].sum()
    ana_serv_realizados = df_ana["qtd_serv_realizado"].sum()
    
    print(f"  ANA - Soma Vlr Pago Compensação: R$ {ana_comp:,.2f}")
    print(f"  ANA - Soma Qtd Fora do Prazo:      {ana_fora_prazo:,.0f}")
    print(f"  ANA - Soma Qtd Serv Realizado:     {ana_serv_realizados:,.0f}")
    
    diff = ana_comp - raw_comp
    perc = (diff / raw_comp) * 100 if raw_comp != 0 else 0
    print(f"\n  📉 Diferença RAW -> ANALYSIS (Compensação R$): R$ {diff:,.2f} ({perc:.4f}%)")
except Exception as e:
    print(f"  ANA - Arquivo analysis não encontrado: {e}")

