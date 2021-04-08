const fs = require('fs')

const { NotionDoc } = require('./index')

const doc = new NotionDoc('c482739b044846619caf39f60088a11e')
doc.imageWidth = 2000

const main = async () => {
    // console.log('title', await doc.title())
    // console.log('createdAt', await doc.createdAt())
    // console.log('updatedAt', await doc.updatedAt())

    fs.writeFileSync(
        './test.html',
        `
            <style>
                img {
                    max-width: 100%;
                }
            </style>
            <link rel="stylesheet" href="https://unpkg.com/katex@0.13.1/dist/katex.min.css">
            ${await doc.html()}
        `
    )
}

main()
