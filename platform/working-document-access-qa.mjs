import {readFile} from 'node:fs/promises';

const [app,index,styles]=await Promise.all([
  readFile(new URL('./app.js',import.meta.url),'utf8'),
  readFile(new URL('./index.html',import.meta.url),'utf8'),
  readFile(new URL('./styles.css',import.meta.url),'utf8')
]);

const checks={
  openAction:app.includes('open-working-document')&&app.includes('Abrir documento'),
  versionViewer:index.includes('working-document-view-dialog')&&app.includes('openWorkingDocumentViewer'),
  allVersionsSelectable:app.includes('working-document-view-version')&&app.includes('workingDocumentVersions'),
  storedTextVisible:app.includes("version.draftContent||''")&&app.includes("working-document-view-content').textContent"),
  safeCopy:app.includes('copy-working-document-version')&&app.includes('copyTextSafely(version.draftContent)'),
  immutableDerivation:app.includes('create-working-document-version-from-current')&&app.includes('openDocumentVersionDialog(documentId,activeWorkingDocumentVersionId)'),
  sourcePrefill:app.includes("source?.draftContent||''")&&app.includes('Nueva versión basada en la versión'),
  accessibleLayout:styles.includes('.working-version-content pre')&&styles.includes('.working-document-actions')
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({passed:!failures.length,checks,failures},null,2));
if(failures.length)process.exit(1);
