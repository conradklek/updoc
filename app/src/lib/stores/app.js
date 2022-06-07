import { api } from "$lib/utils"
import { writable } from "svelte/store"
import Markdoc from "@markdoc/markdoc"
import yaml from "js-yaml"
import postcss from "postcss"
import postcssNested from "postcss-nested"
import apply from "postcss-class-apply/dist/index"


export const app = {
  ...writable([]),
  async login(user) {
    const res = await api.post("users/login", user)
    return res?.data
  },
  async post(user) {
    const res = await api.post("/users", user)
    return res?.data
  },
  async get(username) {
    const res = await api.get("users/" + username)
    return res?.data
  },
  async patch(id, props) {
    const res = await api.patch("users/" + id, props)
    return res?.data
  },
  async delete(id) {
    const res = await api.delete("users/" + id)
    return res?.data
  },
  read: async (data, item, view) => {
    if (!data || !item || !view) return ""
    let config = { tags: {}, variables: {}, partials: {}}
    
    let ast = Markdoc.parse(item.data)
    let frontmatter = ast.attributes.frontmatter
        ? yaml.load(ast.attributes.frontmatter)
        : {}

    config.variables = { ...config.variables, ...frontmatter }
    let walk = (data) => {
      for (let node of data.walk()) {
        if (node.tag !== "partial") {
          if (!config.tags[node.tag]) {
            config.tags[node.tag] = {
              render: node.tag,
              attributes: {...node.attributes}
            }
          } else {
            config.tags[node.tag].attributes = {...config.tags[node.tag].attributes, ...node.attributes}
          }
        }
      }
    }
    walk(ast)
    for (let item of data.filter(i => i.kind === "file").filter(i => i.name.endsWith(".md"))) {
        config.partials[item.path.slice(1).join("/")] = Markdoc.parse(item.data)
        walk(config.partials[item.path.slice(1).join("/")])
    }
    let content = Markdoc.transform(ast, config)

    let doc = Markdoc.renderers.html(content)

    let css = ""

    if (config.variables.styles) {
      for (let item of config.variables.styles) {
        let match = data.find(i => i.path.slice(1).join("/") === item)
        if (match && match?.name.endsWith(".css")) {
          css += `\n${match.data}`
        }
      }
    }

    let reg = /@apply\s*([^;]+);/g
    let matches = []
    let match
    while ((match = reg.exec(css)) !== null) {
      matches.push(...match[1].split(" "))
    }

    let str = ""
    for (let item of new Set(matches)) {
      str += item + " "
    }

    const tailwind = await fetch("/Tailwind.js")
    const tailwindcss = await tailwind.text()
    postcss()
      .use(apply)
      .use(postcssNested)
      .process(css)
      .then(res => {
        view.contentDocument.open()
        view.contentDocument.write(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script defer>${tailwindcss}</script>
            <style id="style" class="${str} hidden">${res.css}</style>
          </head>
          <body>
            ${doc}
          </body>
          </html>
        `)
        view.contentDocument.close()
        queueMicrotask(() => {
          css = view.contentDocument.querySelector("style").innerHTML + "\n" + css
          postcss()
          .use(apply)
          .use(postcssNested)
          .process(css)
          .then(res => {
            view.contentDocument.head.querySelector("#style").innerHTML = css + res.css
          })
        })
      })
  }
}