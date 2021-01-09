function makeFoldersArray() {
    return [
        {
            id: 1,
            folder_name: 'folder 1',
        },
        {
            id: 2,
            folder_name: 'folder 2',
        },
        {
            id: 3,
            folder_name: 'folder 3',
        },
    ]
}

function makeMaliciousFolder() {
    const maliciousFolder = {
        id: 911,
        folder_name: 'Very naughty <script>alert("xss");</script>'
    }

    const expectedFolder = {
        ...maliciousFolder,
        folder_name: 'Very naughty &lt;script&gt;alert(\"xss\");&lt;/script&gt;'
    }

    return {
        maliciousFolder,
        expectedFolder
    }
}

module.exports = { 
    makeFoldersArray,
    makeMaliciousFolder
}