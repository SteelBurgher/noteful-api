const app = require("../src/app");
const knex = require("knex");
const supertest = require("supertest");
const { expect } = require("chai");
const { makeFoldersArray, makeMaliciousFolder } = require("./folders-fixtures");
const { makeNoteArray, makeMaliciousNote } = require("./notes-fixtures");

describe(`Folders Endponts`, function () {
  let db;

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("clean the table", () =>
    db.raw("TRUNCATE folders, notes RESTART IDENTITY CASCADE")
  );

  afterEach("cleanup", () =>
    db.raw("TRUNCATE folders, notes RESTART IDENTITY CASCADE")
  );

  describe(`GET /api/folders`, () => {
    context(`Given no folders in db`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app).get("/api/folders").expect(200, []);
      });
    });

    context("Given there are articles in the database", () => {
      const testFolders = makeFoldersArray();
      beforeEach(() => {
        return db.into("folders").insert(testFolders);
      });

      it(`responds with 200 and all of the folders`, () => {
        return supertest(app).get("/api/folders").expect(200, testFolders);
      });
    });
  });

  describe(`GET /api/folders/:folder_id`, () => {
    context(`Given no folders in db`, () => {
      it(`responds with 404`, () => {
        const folderId = 12345;
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .expect(404, { error: { message: `Folder doesn't exist` } });
      });
    });

    context("Given there are folders and notes in the db", () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNoteArray();

      beforeEach(() => {
        return db
          .into("folders")
          .insert(testFolders)
          .then(() => {
            return db.into("notes").insert(testNotes);
          });
      });

      it("responds with 200 and the notes related to specific folder", () => {
        const folderId = 2;
        const expectedNotes = testNotes.filter(
          (notes) => notes.folder === folderId
        );
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .expect(200, expectedNotes);
      });
    });

    context(`Given an XSS attack folder`, () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNoteArray();
      const { maliciousNote } = makeMaliciousNote();
      const { maliciousFolder } = makeMaliciousFolder();

      beforeEach("insert malicious folder", () => {
        return db
          .into("folders")
          .insert([maliciousFolder])
          .then(() => {
            return db.into("notes").insert([maliciousNote]);
          });
      });

      it("removes XSS attack content", () => {
        const expectedNote = testNotes.filter(
          (notes) => notes.folder === maliciousFolder.id
        );
        return supertest(app)
          .get(`/api/folders/${maliciousFolder.id}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.note_name).to.eql(expectedNote.note_name);
          });
      });
    });
  });

  describe(`POST /api/folders`, () => {
    it(`creates a folder, responding with 201 and the new folder`, function () {
      const newFolder = {
        folder_name: "NEW FOLDER",
      };
      return supertest(app)
        .post("/api/folders")
        .send(newFolder)
        .expect(201)
        .expect((res) => {
          expect(res.body.folder_name).to.eql(newFolder.folder_name);
          expect(res.body).to.have.property("id");
        });
    });
  });

  describe(`DELETE /api/folders/:folder_id`, () => {
    context(`Given no articles`, () => {
      it(`responds with 404`, () => {
        const folderId = 123456;
        return supertest(app)
          .delete(`/api/folders/${folderId}`)
          .expect(404, { error: { message: `Folder doesn't exist` } });
      });
    });

    context("Given there are articles in the database", () => {
      const testFolders = makeFoldersArray();

      beforeEach("insert folders", () => {
        return db.into("folders").insert(testFolders);
      });

      it(`responds with 204 and removes the folder`, () => {
        const idToRemove = 2;
        const expectedFolders = testFolders.filter(
          (folder) => folder.id !== idToRemove
        );

        return supertest(app)
          .delete(`/api/folders/${idToRemove}`)
          .expect(204)
          .then((res) =>
            supertest(app).get(`/api/folders`).expect(expectedFolders)
          );
      });
    });
  });

  describe.only(`PATCH /api/folders/:folder_id`, () => {
    context(`Given no folders`, () => {
      it("responds with 404", () => {
        const folderId = 12345678;
        return supertest(app)
          .patch(`/api/folders/${folderId}`)
          .expect(404, { error: { message: `Folder doesn't exist` } });
      });
    });

    context(`Given there are folders in DB`, () => {
      const testFolders = makeFoldersArray();

      beforeEach("insert folders and notes", () => {
        return db.into("folders").insert(testFolders);
      });

      it(`responds with 204 and updates the folder`, () => {
        const idToUpdate = 2;
        const updatedFolder = {
          folder_name: "updated folder name",
        };

        const expectedFolder = {
          ...testFolders[idToUpdate - 1],
          ...updatedFolder,
        };

        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send(updatedFolder)
          .expect(204)
          .then((res) =>
            supertest(app)
              .get(`/api/folders/${idToUpdate}`)
              .expect(expectedFolder)
          );
      });

      it(`responds with 400 when no require fields supplied`, () => {
        const idToUpdate = 2;
        return supertest(app)
          .patch(`/api/folders/${idToUpdate}`)
          .send({ irrelevantField: "foo" })
          .expect(400, {
            error: {
              message: `Request body must contain 'folder name'`,
            },
          });
      });
    });
  });
});
