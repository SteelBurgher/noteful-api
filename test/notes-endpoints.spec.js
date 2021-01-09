const app = require('../src/app')
const knex = require('knex')
const supertest = require("supertest")
const { expect } = require('chai')
const { makeNoteArray, makeMaliciousNote } = require('./notes-fixtures')
const { makeFoldersArray } = require('./folders-fixtures')

describe(`Notes endpoint`, () => {
    let db

    before('make knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        })
        app.set('db', db)
    })

    after('disconnect from db', () => db.destroy())

    before('clean the table', () => db.raw('TRUNCATE folders, notes RESTART IDENTITY CASCADE'))

    afterEach('cleanup', () => db.raw('TRUNCATE folders, notes RESTART IDENTITY CASCADE'))    

    describe(`GET /api`, () => {
        context(`Given no notes in db`, () => {
            it(`responds with 200 and an empty list`, () => {
                return supertest(app)
                    .get('/api')
                    .expect(200, [])
            })
        })

        context(`Given there are articles in db`, () => {
            const testFolders = makeFoldersArray()
            const testNotes = makeNoteArray()

            beforeEach('insert folders and notes', () => {
                return db
                    .into('folders')
                    .insert(testFolders)
                    .then(() => {
                        return db
                            .into('notes')
                            .insert(testNotes)
                    })
            })

            it(`responds with 200 and all of the notes`, () => {
                return supertest(app)
                    .get('/api')
                    .expect(200, testNotes)
            })
        })

        context(`Given an XSS attack note`, () => {
            const testFolders = makeFoldersArray()
            const testNotes = makeNoteArray()
            const { maliciousNote, expectedNote } = makeMaliciousNote()

            beforeEach('insert malicious note', () => {
                return db
                .into('folders')
                .insert(testFolders)
                .then(() => {
                    return db
                        .into('notes')
                        .insert([ maliciousNote ])
                })
            })

            it('removes XSS attack content', () => {
                return supertest(app)
                    .get(`/api`)
                    .expect(200)
                    .expect(res => {
                        expect(res.body[0].note_name).to.eql(expectedNote.note_name)
                        expect(res.body[0].content).to.eql(expectedNote.content)
                    })
            })
        })
    })

    describe(`GET /api/notes/note_id`, () => {
        context('Given no valid note id', () => {
            it('responds with 404', () => {
                const noteId = 1234565
                return supertest(app)
                    .get(`/api/notes/${noteId}`)
                    .expect(404, { error: { message: `Note doesn't exist` } })
            })
        })

        context('Given there are notes in the db', () => {
            const testFolders = makeFoldersArray()
            const testNotes = makeNoteArray()

            beforeEach('insert folders and notes', () => {
                return db
                    .into('folders')
                    .insert(testFolders)
                    .then(() => {
                        return db
                            .into('notes')
                            .insert(testNotes)
                    })
            })
        

            it('responds with 200 and the correct note', () => {
                const testNotes = makeNoteArray()
                const noteId = 2
                const expectedNote = testNotes[noteId -1]
                return supertest(app)
                    .get(`/api/notes/${noteId}`)
                    .expect(200, expectedNote)
            })
        })

        context(`Given an XSS attack notes`, () => {
            const testFolders = makeFoldersArray()
            const { maliciousNote, expectedNote } = makeMaliciousNote()

            beforeEach('insert malicious note', () => {
                return db
                    .into('folders')
                    .insert(testFolders)
                    .then(() => {
                        return db
                            .into('notes')
                            .insert([ maliciousNote ])
                    })
            })

            it('removes XSS attack content', () => {
                return supertest(app)
                    .get(`/api/notes/${maliciousNote.id}`)
                    .expect(200)
                    .expect(res => {
                        expect(res.body.note_name).to.eql(expectedNote.note_name)
                        expect(res.body.content).to.eql(expectedNote.content)
                    })
            })
        })
    })

    describe(`POST /api/notes`, () => {
        const testFolders = makeFoldersArray()

        beforeEach('insert notes', () => {
            return db
                .into('folders')
                .insert(testFolders)
        })

        it('creates a new note, responding with 201 and the new note', () => {
            const newNote = {
                note_name: 'New Note Name',
                content: 'New Note Content',
                folder: 2
            }

            return supertest(app)
                .post(`/api/notes`)
                .send(newNote)
                .expect(201)
                .expect(res => {
                    expect(res.body.note_name).to.eql(newNote.note_name)
                    expect(res.body.content).to.eql(newNote.content)
                    expect(res.body.folder).to.eql(newNote.folder)
                    expect(res.headers.location).to.eql(`/api/notes/${res.body.id}`)
                    const expected = new Date().toLocaleString()
                    const actual = new Date(res.body.modified).toLocaleString()
                    expect(actual).to.eql(expected)
                })
                .then(res =>
                    supertest(app)
                        .get(`/api/notes/${res.body.id}`)
                        .expect(res.body)
                )
        })
    })

    describe(`PATCH /api/notes/:note_id`, () => {
        context(`Given no notes`, () => {
            it('responds with 404', () => {
                const noteId = 12345678
                return supertest(app)
                    .patch(`/api/notes/${noteId}`)
                    .expect(404, { error: { message: `Note doesn't exist` } })
            })
        })

        context(`Given there are notes in DB`, () => {
            const testFolders = makeFoldersArray()
            const testNotes = makeNoteArray()

            beforeEach('insert folders and notes', () => {
                return db
                    .into('folders')
                    .insert(testFolders)
                    .then(() => {
                        return db
                            .into('notes')
                            .insert(testNotes)
                    })
            })

            it(`responds with 204 and updates the note`, () => {
                const idToUpdate = 2
                const updatedNote = {
                    note_name: 'updated note',
                    content: 'updated Content',
                    folder: 1

                }
                const expectedNote = {
                    ...testNotes[idToUpdate - 1],
                    ...updatedNote
                }

                return supertest(app)
                    .patch(`/api/notes/${idToUpdate}`)
                    .send(updatedNote)
                    .expect(204)
                    .then(res => 
                        supertest(app)
                            .get(`/api/notes/${idToUpdate}`)
                            .expect(expectedNote)    
                    )
            })

            it(`responds with 400 when no require fields supplied`, () => {
                const idToUpdate = 2
                return supertest(app)
                    .patch(`/api/notes/${idToUpdate}`)
                    .send({ irrelevantField: 'foo' })
                    .expect(400, {
                        error: {
                            message: `Request body must contain either 'name', 'content', or 'folder'`
                        }
                    })
            })

            it(`responds with 204 when only updating a subset of fields`, () => {
                const idToUpdate = 2
                const updatedNote = {
                    note_name: 'updated note name',
                }
                const expectedNote = {
                    ...testNotes[idToUpdate - 1],
                    ...updatedNote
                }

                return supertest(app)
                    .patch(`/api/notes/${idToUpdate}`)
                    .send({
                        ...updatedNote,
                        ignore: 'should not be in GET response'
                    })
                    .expect(204)
                    .then(res =>
                        supertest(app)
                            .get(`/api/notes/${idToUpdate}`) 
                            .expect(expectedNote)
                    )
            })
        })
    })


})