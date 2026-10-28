"""Import the prepared analysis workbook/JSON. Run only when updating data.

Usage: python scripts/import-data.py --source <analysis-directory>
Requires openpyxl for import only. The site/build has no Python dependency.
"""
from pathlib import Path
import argparse,csv,hashlib,json,re,shutil
from openpyxl import load_workbook
from openpyxl.worksheet.table import Table,TableStyleInfo
from openpyxl.utils import get_column_letter

args=argparse.ArgumentParser();args.add_argument('--source',type=Path,required=True);source=args.parse_args().source.resolve()
root=Path(__file__).resolve().parents[1]
original=json.loads((source/'称号条件总表.json').read_text(encoding='utf-8'))
book=load_workbook(source/'称号解禁条件_日英中.xlsx')
assert book.sheetnames==['日本語','English','中文']
for folder in ['data','assets/titles','downloads']:(root/folder).mkdir(parents=True,exist_ok=True)
def review(text):
    if any(s in text for s in ['保留ID','历史保留项','历史称号保留','已获可继承']):return 'historical'
    return 'pending' if re.search(r'待|未|有限|边界',text) else 'confirmed'
def clean_label(text):
    return re.sub(r'（短名编码异常.*?）','',text).strip()
rows=[];images=set()
for n,r in enumerate(original,7):
    conditions={};confidence={}
    for lang,sheet in zip(['ja','en','zh'],book.worksheets):
        assert sheet.cell(n,1).value==r['version'] and sheet.cell(n,3).value==r['id']
        conditions[lang]=sheet.cell(n,8).value
        confidence[lang]=sheet.cell(n,11).value
    kind='regular' if r['kind']=='普通' else 'commemorative'
    name='' if '名称见原图' in r['name'] else r['name']
    image_paths={}
    for key in ['name_image','hint_image']:
        if not r[key]:continue
        p=Path(r[key]);target=Path('assets/titles')/p.parts[1]/p.name
        (root/target).parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source/p,root/target);images.add(target.as_posix());image_paths[key]=target.as_posix()
    row=dict(key=f"{r['version']}-{kind}-{r['id']}",version=r['version'],kind=kind,id=r['id'],
             badgeIndex=r.get('badge_index'),name=name,mode='unverified' if r['mode']=='未核准' else r['mode'],
             conditions=conditions,confidence=confidence,review=review(r['confidence']),evidence=r['evidence'],
             hint='' if r['hint_image'] else r['official_hint'],images=image_paths,
             songs=[{'id':s['music_id'],'label':clean_label(s['short_title'])} for s in r['music_short_titles']])
    rows.append(row)
assert len(rows)==992 and len({r['key'] for r in rows})==992
payload={'updated':'2026-10-28','languages':['ja','en','zh'],'rows':rows}
(root/'data/titles.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8',newline='\n')
with (root/'downloads/gfdm-titles.csv').open('w',encoding='utf-8-sig',newline='') as f:
    out=csv.writer(f,lineterminator='\n');out.writerow(['版本','类别','ID','badge数组编号','称号名（原文）','机种','解禁条件','核准状态','曲目短名','程序证据'])
    for r in rows:out.writerow([r['version'],r['kind'],r['id'],r['badgeIndex'],r['name'],r['mode'],r['conditions']['zh'],r['confidence']['zh'],' / '.join(f"{s['id']}: {s['label']}" for s in r['songs']),r['evidence']])
# Keep the public workbook free of source-transcription diagnostics. Names are
# the identical original strings in all three languages; only conditions vary.
notes=[
 '解禁条件・分類・確認状況を日本語化。称号名と公式ヒントは原文のまま保持。画像リンクから元の表示を参照できます。',
 'Requirements, categories, and review statuses are localized. Title names and official hints retain their original text. Image links show the original display.',
 '条件、类别与核准状态按本页语言显示；称号名与官方提示保持原文，可通过图片链接查看原始显示。']
widths=[10,24,9,14,31,12,100,53,57,43,68,38,38,34]
for i,ws in enumerate(book.worksheets):
    for n,r in enumerate(original,7):
        ws.cell(n,5).value=r['name']
        # Hyperlinks must remain usable next to this repository's downloads.
        for col,key in [(5,'name_image'),(14,'name_image'),(15,'hint_image')]:
            if r[key]:
                p=Path(r[key]);ws.cell(n,col).hyperlink='../assets/titles/'+p.parts[1]+'/'+p.name
        ws.cell(n,16).hyperlink=None
    for table in list(ws.tables):del ws.tables[table]
    for n in range(1,5):ws.unmerge_cells(f'A{n}:P{n}')
    ws.delete_cols(13);ws.delete_cols(6)
    for n in range(1,5):ws.merge_cells(f'A{n}:N{n}')
    ws['A3']=notes[i];ws.print_area='A1:N998'
    for c,w in enumerate(widths,1):ws.column_dimensions[get_column_letter(c)].width=w
    tab=Table(displayName=['JapaneseTitles','EnglishTitles','ChineseTitles'][i],ref='A6:N998')
    tab.tableStyleInfo=TableStyleInfo(name='TableStyleMedium2',showRowStripes=True);ws.add_table(tab)
book.save(root/'downloads/gfdm-titles-ja-en-zh.xlsx')
manifest={'updated':payload['updated'],'rows':len(rows),'regular':sum(r['kind']=='regular' for r in rows),'commemorative':sum(r['kind']=='commemorative' for r in rows),
          'images':len(images),'title_names':'Original names, unchanged across languages.',
          'files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['data/titles.json','downloads/gfdm-titles.csv','downloads/gfdm-titles-ja-en-zh.xlsx']}}
(root/'data/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:v for k,v in manifest.items() if k!='files'},ensure_ascii=False))
