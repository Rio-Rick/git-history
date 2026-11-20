import Prism from "./prism-core.js";
import "./prism-languages.js";

const newlineRe = /\r\n|\r|\n/;

// Take a list of nested tokens
// (token.content may contain an array of tokens)
// and flatten it so content is always a string
// and type the type of the leaf
function flattenTokens(tokens) {
  const flatList = [];
  tokens.forEach(token => {
    if (Array.isArray(token.content)) {
      flatList.push(...flattenTokens(token.content));
    } else {
      flatList.push(token);
    }
  });
  return flatList;
}

// Convert strings to tokens
function tokenizeStrings(prismTokens, parentType = "plain") {
  return prismTokens.map(pt =>
    typeof pt === "string"
      ? { type: parentType, content: pt }
      : {
          type: pt.type,
          content: Array.isArray(pt.content)
            ? tokenizeStrings(pt.content, pt.type)
            : pt.content
        }
  );
}

export default function tokenize(code, language = "plain") {
  // a language we do not know is shown as plain text
  const grammar = Prism.languages[language] || Prism.languages.plain;
  const prismTokens = Prism.tokenize(code, grammar);
  const nestedTokens = tokenizeStrings(prismTokens);
  const tokens = flattenTokens(nestedTokens);

  let currentLine = [];
  const lines = [currentLine];
  tokens.forEach(token => {
    const contentLines = token.content.split(newlineRe);

    const firstContent = contentLines.shift();
    if (firstContent !== "") {
      currentLine.push({ type: token.type, content: firstContent });
    }
    contentLines.forEach(content => {
      currentLine = [];
      lines.push(currentLine);
      if (content !== "") {
        currentLine.push({ type: token.type, content });
      }
    });
  });
  return lines;
}
