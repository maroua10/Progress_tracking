import { test } from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('Le lecteur PDF compatible fonctionne sans les API JavaScript récentes',()=>{
 const script=`
  import {PDFDocument} from 'pdf-lib';
  const pdf=await PDFDocument.create();pdf.addPage().drawText('TEST compatibility');const bytes=await pdf.save();
  Promise.withResolvers=undefined;Promise.try=undefined;Map.prototype.getOrInsert=undefined;Map.prototype.getOrInsertComputed=undefined;
  const {installPdfCompatibility}=await import('./lib/pdf-compatibility.mjs');installPdfCompatibility();
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task=getDocument({data:bytes});const document=await task.promise;
  const page=await document.getPage(1),text=await page.getTextContent();
  if(!text.items.some(item=>item.str.includes('TEST compatibility')))throw new Error('Le document reste illisible.');
  await task.destroy();console.log('PDF_COMPATIBLE');
 `;
 const output=execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:20000});
 assert.match(output,/PDF_COMPATIBLE/);
});
