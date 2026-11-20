// The page of the webview. It only loads our own script and style, and the
// script needs the nonce, so nothing else can run in it.

function getHtml({ cspSource, nonce, scriptUri, styleUri, data }) {
  // `<` is escaped so the data can never close the block it is in
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource} data:; font-src ${cspSource};"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Git File History</title>
    <link rel="stylesheet" href="${styleUri}" />
    <style>
      html, body { background-color: rgb(1, 22, 39); }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script id="gfh-data" type="application/json">${json}</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>
`;
}

module.exports = { getHtml };
