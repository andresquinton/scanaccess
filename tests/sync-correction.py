import re, sqlite3
from pathlib import Path
source=Path('app/api/sheets/route.ts').read_text()
query=re.search(r"prepare\('(INSERT INTO people[^']+)'\)",source).group(1)
db=sqlite3.connect(':memory:')
for migration in sorted(Path('drizzle').glob('*.sql')): db.executescript(migration.read_text())
db.execute('INSERT INTO events VALUES(?,?,?)',('test','Test','2026-01-01'))
row=('test','guest:00000000-0000-0000-0000-000000000000','Invitada','2026-10-15T10:00:00Z','Manual')
db.execute(query,row)
db.execute('UPDATE people SET arrived=NULL,device=NULL,revision=1')
db.execute(query,row)
assert db.execute('SELECT arrived,device,revision FROM people').fetchone()==(None,None,1), 'Una lectura antigua no debe resucitar una entrada anulada'
db.execute("UPDATE people SET arrived='2026-10-15T11:00:00Z',device='Manual',revision=2")
db.execute(query,('test',row[1],'Invitada renombrada',None,None))
assert db.execute('SELECT name,arrived,revision FROM people').fetchone()==('Invitada renombrada','2026-10-15T11:00:00Z',2)
print('PASS: sincronización conserva anulaciones, entradas nuevas y renombrado de invitados con ID estable.')
