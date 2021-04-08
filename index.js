const fetch = require('node-fetch')
const katex = require('katex')
const prism = require('prismjs')

// Add more languages from here:
// https://github.com/PrismJS/prism/tree/master/components
require('prismjs/components/prism-markup-templating')
require('prismjs/components/prism-markdown')
require('prismjs/components/prism-css')
require('prismjs/components/prism-php')
require('prismjs/components/prism-json')
require('prismjs/components/prism-javascript')
require('prismjs/components/prism-jsx')
require('prismjs/components/prism-bash')
require('prismjs/components/prism-yaml')
require('prismjs/components/prism-toml')
require('prismjs/components/prism-java')

const escapeHtml = text => text.replace(/</g, '&lt;')

class NotionDoc {
    downgradeHeadings = false // Turns h1 to h2, etc
    imageWidth = null

    #blocks = {}

    constructor(id) {
        const cleanId = id.split('?')[0].replace(/-/g, '').substr(-32)
        this.id = cleanId.substr(0, 8)
                    + '-' + cleanId.substr(8, 4)
                    + '-' + cleanId.substr(12, 4)
                    + '-' + cleanId.substr(16, 4)
                    + '-' + cleanId.substr(20)
    }

    async #call(method, body) {
        const req = await fetch(`https://www.notion.so/api/v3/${method}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        })
        return req.json()
    }

    async #load(blockIds) {
        const blockIdsToLoad = blockIds.filter(blockId => !this.#blocks[blockId])

        if(blockIdsToLoad.length > 0) {
            const response = await this.#call('syncRecordValues', {
                requests: blockIds.map(blockId => ({
                    id: blockId,
                    table: 'block',
                    version: -1
                }))
            })

            for(const blockId in response.recordMap.block) {
                this.#blocks[blockId] = response.recordMap.block[blockId].value
            }
        }
    }

    async #loadPageContents() {
        let lastChunk = null
        let hasMoreChunks = true
        let count = 0

        let blocks = []

        while(hasMoreChunks) {
            const cursor = lastChunk?.cursor || { 'stack':  [] }

            const chunk = await this.#call('loadCachedPageChunk', {
                pageId: this.id,
                limit: 100,
                cursor: cursor,
                chunkNumber: count,
                verticalColumns: false
            })

            for(const blockId in chunk.recordMap.block) {
                blocks[blockId] = chunk.recordMap.block[blockId]
            }

            lastChunk = chunk

            if(chunk.cursor.stack.length === 0) hasMoreChunks = false

            count++
            if(count > 9) hasMoreChunks = false // Hard stop at 9 requests (~900 blocks).
        }

        for(const blockId in blocks) {
            this.#blocks[blockId] = blocks[blockId].value
        }
    }

    #colorClass(string) {
        let color = string.split('_')[0]
        if(color === 'teal') color = 'green'
        const isBackground = string.includes('background')
        return `${isBackground ? 'background' : 'color'}-${color}`
    }

    #pageTitleFromId(pageId) {
        this.#load([pageId])
        const title = this.#blocks[pageId]?.properties?.title

        return title ? this.#textArrayToText(title) : 'Untitled'
    }

    #notionImageSrc(url, block) {
        return `https://www.notion.so/image/${encodeURIComponent(url)}?table=block&id=${block.id}&cache=v2${this.imageWidth ? `&width=${this.imageWidth}` : ''}`
    }

    #textArrayToText(pieces) {
        if(! pieces) return ''
        return pieces.map(piece => piece[0]).join('')
    }

    #textArrayToHtml(pieces, options = { br: true, escape: true }) {
        if(! pieces) return ''

        const htmlPieces = pieces.map(piece => {
            let text = options.escape ? escapeHtml(piece[0]) : piece[0]

            const modifiers = piece[1] || []

            for(const mod of modifiers) {
                const modCode = mod[0]

                if(modCode === 'b') {
                    text = `<strong>${text}</strong>`
                } else if(modCode === 'i') {
                    text = `<em>${text}</em>`
                } else if(modCode === '_') {
                    text = `<u>${text}</u>`
                } else if(modCode === 's') {
                    text = `<strike>${text}</strike>`
                } else if(modCode ===  'a') {
                    text = `<a href="${mod[1]}">${text}</a>`
                } else if(modCode === 'h') {
                    text = `<span class="${this.#colorClass(mod[1])}">${text}</span>`
                } else if(modCode === 'c') {
                    text = `<code>${text}</code>`
                } else if(modCode === 'e') {
                    text = katex.renderToString(mod[1], { throwOnError: false })
                } else if(modCode === 'p') {
                    const pageId = mod[1]
                    const title = this.#pageTitleFromId(pageId)
                    return `<a data-page-id="${pageId}">${title}</a>`
                } else {
                    console.warn('notion-api: Unhandled text modification', mod)
                }
            }

            return text
        })

        let joined = htmlPieces.join('')

        return options.br ? joined.replace(/\n/g, '<br>') : joined
    }

    async #blockToHtml(blockId) {
        await this.#load([blockId])
        const block = this.#blocks[blockId]
        if(! block) {
            console.warn(`notion-api: Couldn't load block https://notion.so/${blockId.replace(/-/g, '')}`)
            return ''
        }
        const type = block.type

        if(['header', 'sub_header', 'sub_sub_header', 'text'].includes(type)) {
            const el = {
                'header': this.downgradeHeadings ? 'h2' : 'h1',
                'sub_header': this.downgradeHeadings ? 'h3' : 'h2',
                'sub_sub_header': this.downgradeHeadings ? 'h4' : 'h3',
                'text': 'p'
            }[type]

            const indented = []
            if(block.content) {
                for(const blockId of block.content) {
                    indented.push(`<div class="indented">${await this.#blockToHtml(blockId)}</div>`)
                }
            }

            const classDeclaration = block?.format?.block_color ? ` class="${this.#colorClass(block.format.block_color)}"` : ''

            return `<${el} ${classDeclaration}>${this.#textArrayToHtml(block.properties?.title)}</${el}>${indented.join('')}`
        } else if(['numbered_list', 'bulleted_list'].includes(type)) {
            const el = {
                'numbered_list': 'ol',
                'bulleted_list': 'ul'
            }[type]

            const indented = []
            if(block.content) {
                for(const blockId of block.content) {
                    indented.push(await this.#blockToHtml(blockId))
                }
            }

            return `<${el}><li>${this.#textArrayToHtml(block?.properties?.title)}${indented.join('')}</li></${el}>`
        } else if(type === 'to_do') {
            const checked = block?.properties?.checked || false
            const checkedHtml = checked ? ' checked' : ''
            return `<div class="checklist"><div><input type="checkbox" disabled${checkedHtml}><label>${this.#textArrayToHtml(block?.properties?.title)}</label></div></div>`
        } else if(type === 'code') {
            const language = this.#textArrayToText(block.properties.language).toLowerCase().replace(/ /g, '-')

            const code = this.#textArrayToHtml(block?.properties?.title, { br: false, escape: false })
                            .replace(/\t/g, '  ')

            let highlighted = code

            try {
                highlighted = prism.highlight(code, prism.languages[language], language)
            } catch{}

            highlighted = highlighted.replace(/\n/g, '<br>')

            return `<pre><code class="language-${language}">${highlighted}</code></pre>`
        } else if(type === 'callout') {
            const icon = block.format.page_icon
            const src = icon.includes('http') ? this.#notionImageSrc(icon, block) : `https://emojicdn.elk.sh/${encodeURIComponent(icon)}`

            return `<div class="callout${block?.format?.block_color ? ' ' + this.#colorClass(block.format.block_color) : ''}"><img src="${src}"><p>${this.#textArrayToHtml(block?.properties?.title)}</p></div>`
        } else if(type === 'quote') {
            return `<blockquote>${this.#textArrayToHtml(block?.properties?.title)}</blockquote>`
        } else if(type === 'divider') {
            return '<hr>'
        } else if(type === 'image') {
            return `<img src="${this.#notionImageSrc(block.format.display_source, block)}">`
        } else if(type === 'equation') {
            const equation = katex.renderToString(this.#textArrayToText(block?.properties?.title), {
                throwOnError: false,
                displayMode: true
            })

            return `<div class="block-equation">${equation}</div>`
        } else if(type === 'toggle') {
            await this.#load(block.content)

            const inside = []
            for(const blockId of block.content) {
                inside.push(await this.#blockToHtml(blockId))
            }

            return `<details><summary>${this.#textArrayToHtml(block?.properties?.title)}</summary>${inside.join('')}</details>`
        } else if(type === 'page') {
            return `<div class="block-page-link"><a data-page-id="${block.id}">${this.#textArrayToText(block.properties.title) || 'Untitled'}</div>`
        } else {
            console.warn('notion-api: Unhandled block type', type)
        }
    }

    async title() {
        await this.#load([this.id])
        const page = this.#blocks[this.id]
        return this.#textArrayToText(page.properties.title)
    }

    async createdAt() {
        await this.#load([this.id])
        const page = this.#blocks[this.id]
        return page.created_time
    }

    async updatedAt() {
        await this.#load([this.id])
        const page = this.#blocks[this.id]
        return page.last_edited_time
    }

    async html() {
        await this.#loadPageContents()

        const html = []

        for(const blockId of this.#blocks[this.id].content) {
            html.push(await this.#blockToHtml(blockId))
        }

        let joinedHtml = html.join('')
                            .replace(/<\/ol><ol>/g, '')
                            .replace(/<\/ul><ul>/g, '')
                            .replace(/<\/div><div class=\"checklist\">/g, '')
        return joinedHtml
    }
}

module.exports = {
    NotionDoc
}
