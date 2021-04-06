const fs = require('fs')

const { NotionDoc } = require('./index')

const doc = new NotionDoc('a2449a4a48884c49bd5225828d29b2ed')

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
