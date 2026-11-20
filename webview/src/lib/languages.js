// Language (the name Prism knows it by) of a file, from its name.
// What is not here is shown as plain text.
const filenameRegex = [
  { lang: "javascript", regex: /\.(js|mjs|cjs)$/i },
  { lang: "jsx", regex: /\.jsx$/i },
  { lang: "typescript", regex: /\.(ts|mts|cts)$/i },
  { lang: "tsx", regex: /\.tsx$/i },
  { lang: "json", regex: /\.(json|jsonc|json5)$|\.babelrc$/i },
  { lang: "yaml", regex: /\.(yaml|yml)$/i },
  { lang: "bash", regex: /\.(sh|bash|zsh)$/i },
  { lang: "python", regex: /\.py$/i },
  { lang: "dart", regex: /\.dart$/i },
  { lang: "perl", regex: /\.(pl|pm)$/i },
  { lang: "nasm", regex: /\.(asm|nasm)$/i },
  { lang: "groovy", regex: /\.(groovy|gradle)$/i },
  { lang: "sql", regex: /\.(sql|mysql)$/i },
  { lang: "plsql", regex: /\.(pgsql|plsql)$/i },
  { lang: "css", regex: /\.css$/i },
  { lang: "less", regex: /\.less$/i },
  { lang: "scss", regex: /\.scss$/i },
  { lang: "ini", regex: /\.ini$|\.editorconfig$/i },
  { lang: "markup", regex: /\.(xml|html|htm|svg|mathml|vue)$/i },
  { lang: "batch", regex: /\.(bat|cmd)$/i },
  { lang: "clojure", regex: /\.(clj|cljs)$/i },
  { lang: "coffeescript", regex: /\.coffee$/i },
  { lang: "c", regex: /\.(c|h)$/i },
  { lang: "cpp", regex: /\.(cpp|cc|cxx|hpp|hh|hxx)$/i },
  { lang: "csharp", regex: /\.cs$/i },
  { lang: "csp", regex: /\.csp$/i },
  { lang: "diff", regex: /\.(diff|patch)$/i },
  { lang: "docker", regex: /dockerfile$/i },
  { lang: "fsharp", regex: /\.(fs|fsx|fsharp)$/i },
  { lang: "go", regex: /\.go$/i },
  { lang: "graphql", regex: /\.(graphql|gql)$/i },
  { lang: "handlebars", regex: /\.(hbs|handlebars)$/i },
  { lang: "haskell", regex: /\.hs$/i },
  { lang: "java", regex: /\.java$/i },
  { lang: "kotlin", regex: /\.(kt|kts)$/i },
  { lang: "lua", regex: /\.lua$/i },
  { lang: "makefile", regex: /(^|[\\/])makefile$|\.mk$/i },
  { lang: "markdown", regex: /\.(md|markdown)$/i },
  { lang: "objectivec", regex: /\.(objc|mm)$/i },
  { lang: "php", regex: /\.php$/i },
  { lang: "powershell", regex: /\.(ps|ps1|psm1)$/i },
  { lang: "pug", regex: /\.(pug|jade)$/i },
  { lang: "r", regex: /\.r$/i },
  { lang: "cshtml", regex: /\.(razor|cshtml)$/i },
  { lang: "reason", regex: /\.(re|rei)$/i },
  { lang: "ruby", regex: /\.rb$/i },
  { lang: "rust", regex: /\.rs$/i },
  { lang: "scala", regex: /\.scala$/i },
  { lang: "scheme", regex: /\.(scheme|scm)$/i },
  { lang: "solidity", regex: /\.(solidity|sol)$/i },
  { lang: "smalltalk", regex: /\.st$/i },
  { lang: "swift", regex: /\.swift$/i },
  { lang: "toml", regex: /\.toml$/i },
  { lang: "visual-basic", regex: /\.vb$/i },
  { lang: "wasm", regex: /\.(wasm|wat)$/i }
];

export const PLAIN = "plain";

export function getLanguage(filename) {
  const found = filenameRegex.find(x => x.regex.test(filename));
  return found ? found.lang : PLAIN;
}

export const languages = filenameRegex.map(x => x.lang);
