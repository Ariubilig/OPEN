/** Save text as a file in the browser (a calendar file, an exported story). */
export function downloadFile(fileName: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  // later: some browsers still read the file after click() returns
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
