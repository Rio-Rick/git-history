const theme = {
  plain: {
    color: "#d6deeb",
    backgroundColor: "#011627"
  },
  styles: [
    {
      types: ["changed"],
      style: {
        color: "rgb(162, 191, 252)",
        fontStyle: "italic"
      }
    },
    {
      types: ["deleted"],
      style: {
        color: "rgba(239, 83, 80, 0.56)",
        fontStyle: "italic"
      }
    },
    {
      types: ["inserted", "attr-name"],
      style: {
        color: "rgb(173, 219, 103)",
        fontStyle: "italic"
      }
    },
    {
      types: ["comment"],
      style: {
        color: "rgb(99, 119, 119)",
        fontStyle: "italic"
      }
    },
    {
      types: ["string", "url"],
      style: {
        color: "rgb(173, 219, 103)"
      }
    },
    {
      types: ["variable"],
      style: {
        color: "rgb(214, 222, 235)"
      }
    },
    {
      types: ["number"],
      style: {
        color: "rgb(247, 140, 108)"
      }
    },
    {
      types: ["builtin", "char", "constant", "function"],
      style: {
        color: "rgb(130, 170, 255)"
      }
    },
    {
      // This was manually added after the auto-generation
      // so that punctuations are not italicised
      types: ["punctuation"],
      style: {
        color: "rgb(199, 146, 234)"
      }
    },
    {
      types: ["selector", "doctype"],
      style: {
        color: "rgb(199, 146, 234)",
        fontStyle: "italic"
      }
    },
    {
      types: ["class-name"],
      style: {
        color: "rgb(255, 203, 139)"
      }
    },
    {
      types: ["tag", "operator", "keyword"],
      style: {
        color: "rgb(127, 219, 202)"
      }
    },
    {
      types: ["boolean"],
      style: {
        color: "rgb(255, 88, 116)"
      }
    },
    {
      types: ["property"],
      style: {
        color: "rgb(128, 203, 196)"
      }
    },
    {
      types: ["namespace"],
      style: {
        color: "rgb(178, 204, 214)"
      }
    }
  ]
};

// The version of Prism we use has more kinds of tokens than the ones this
// theme was made for. They get the style of the kind they are a kind of.
const sameStyleAs = {
  string: [
    "attr-value",
    "triple-quoted-string",
    "template-punctuation",
    "code-snippet",
    "code-block",
    "regex",
    "regex-source",
    "regex-flags",
    "regex-delimiter"
  ],
  function: [
    "function-variable",
    "function-definition",
    "decorator",
    "annotation",
    "at",
    "macro"
  ],
  keyword: [
    "atrule",
    "rule",
    "important",
    "null",
    "code-language",
    "directive",
    "directive-hash",
    "title"
  ],
  punctuation: [
    "interpolation-punctuation",
    "conversion-option",
    "script-punctuation",
    "double-colon",
    "list",
    "blockquote"
  ],
  property: ["literal-property", "key"],
  comment: ["shebang"],
  variable: ["parameter", "interpolation", "for-or-select", "content"],
  constant: ["entity"],
  doctype: ["doctype-tag", "name"],
  selector: ["coord"]
};

Object.keys(sameStyleAs).forEach(base => {
  const entry = theme.styles.find(({ types }) => types.includes(base));
  entry.types.push(...sameStyleAs[base]);
});

export default theme;
