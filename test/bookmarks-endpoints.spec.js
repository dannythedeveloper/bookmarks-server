/* eslint-disable strict */
const { expect } = require('chai');
const knex = require('knex');
const { describe } = require('mocha');
const supertest = require('supertest');
const app = require('../src/app');
const { makeBookmarksArray, makeMaliciousBookmark } = require('./bookmarks.fixtures');

describe('Bookmarks Endpoints', function() {
  let db; 

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('clean the table', () => db('bookmarks').truncate());

  afterEach('cleanup', () => db('bookmarks').truncate());

  describe('GET /bookmarks', () => {
    context('Given no bookmarks', () => {
      it('responds with 200 and empty list', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, []);
      });
    });

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();
      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });
      it('responds with 200 and all of the bookmarks', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, testBookmarks);
      });
    });

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert([ maliciousBookmark ]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get('/bookmarks')
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body[0].title).to.eql(expectedBookmark.title);
            expect(res.body[0].description).to.eql(expectedBookmark.description);
          });
      });
    });
  });

  describe('GET /bookmarks/:bookmark_id', () => {
    context('Given no bookmarks', () => {
      it('responds with 404', () => {
        const articleId = 123456;
        return supertest(app)
          .get(`/bookmarks/${articleId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(404, { error: { message: 'Bookmark Not Found' } });
      });
    });

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();
      beforeEach('insert bookmarks', () => {
        return db
          .into('bookmarks')
          .insert(testBookmarks);
      });
      it('responds with 200 and the specified bookmark', () => {
        const bookmarkId = 2;
        const expectedBookmark = testBookmarks[bookmarkId - 1];
        return supertest(app)
          .get(`/bookmarks/${bookmarkId}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200, expectedBookmark);
      });
    });

    context('Given an XSS attack bookmark', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();

      beforeEach('insert malicious bookmark', () => {
        return db
          .into('bookmarks')
          .insert([ maliciousBookmark ]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/bookmarks/${maliciousBookmark.id}`)
          .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
          .expect(200)
          .expect(res => {
            expect(res.body.title).to.eql(expectedBookmark.title);
            expect(res.body.description).to.eql(expectedBookmark.description);
          });
      });
    });

  });

  describe('POST /bookmarks', () => {
    it('responds with 400 missing \'title\' if not supplied', () => {
      const newBookmarkMissingTitle = {
        // title: 'test-title',
        url: 'https://test.com',
        rating: 1,
      };
      return supertest(app)
        .post('/bookmarks')
        .send(newBookmarkMissingTitle)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, {
          error: { message: '\'title\' is required' }
        });
    });

    it('responds with 400 missing \'url\' if not supplied', () => {
      const newBookmarkMissingUrl = {
        title: 'New Bookmark',
        // url: 'https://www.google.com',
        rating: 4
      };
      return supertest(app)
        .post('/bookmarks')
        .send(newBookmarkMissingUrl)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, {
          error: { message: '\'url\' is required'}
        });
    });

    it('responds with 400 missing \'rating\' if not supplied', () => {
      const newBookmarkMissingRating = {
        title: 'New Bookmark',
        url: 'https://www.google.com',
        // rating: 4
      };
      return supertest(app)
        .post('/bookmarks')
        .send(newBookmarkMissingRating)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, {
          error: { message: '\'rating\' is required'}
        });
    });

    it('responds with 400 invalid \'rating\' if not between 0 and 5', () => {
      const newBookmarkInvalidRating = {
        title: 'test-title',
        url: 'https://test.com',
        rating: 'invalid',
      };
      return supertest(app)
        .post('/bookmarks')
        .send(newBookmarkInvalidRating)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, {
          error: { message: '\'rating\' must be a number between 0 and 5' }
        });
    });

    it('responds with 400 invalid \'url\' if not a valid URL', () => {
      const newBookmarkInvalidUrl = {
        title: 'test-title',
        url: 'htp://invalid-url',
        rating: 1,
      };
      return supertest(app)
        .post('/bookmarks')
        .send(newBookmarkInvalidUrl)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(400, {
          error: { message: '\'url\' must be a valid URL' }
        });
    });

    it('creates a bookmark, responding with 201 and the new bookmark', function () {
      this.retries(3);
      const newBookmark = {
        title: 'New Bookmark',
        url: 'https://www.google.com',
        rating: 4,
        description: 'Test description' 
      };
      return supertest(app)
        .post('/bookmarks')
        .send(newBookmark)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(newBookmark.title);
          expect(res.body.url).to.eql(newBookmark.url);
          expect(res.body.rating).to.eql(newBookmark.rating);
          expect(res.body.description).to.eql(newBookmark.description);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`/bookmarks/${res.body.id}`);
        })
        .then(postRes => 
          supertest(app)
            .get(`/bookmarks/${postRes.body.id}`)  
            .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
            .expect(postRes.body)
        );
    });

    it('removes XSS attack content', () => {
      const { maliciousBookmark, expectedBookmark } = makeMaliciousBookmark();
      return supertest(app)
        .post('/bookmarks')
        .send(maliciousBookmark)
        .set('Authorization', `Bearer ${process.env.API_TOKEN}`)
        .expect(201)
        .expect(res => {
          expect(res.body.title).to.eql(expectedBookmark.title);
          expect(res.body.description).to.eql(expectedBookmark.description);
        });
    });
  });

  describe('DELETE /bookmarks/:bookmark_id', () => {
    context('Given no articles', () => {
      it('responds with 404', () => {
        const bookmarkId = 123456;
        return supertest(app)
          .delete(`/bookmarks/${bookmarkId}`)
          .expect(404, { error: { message: 'Bookmark doesn\'t exist' } });
      });
    });

    context('Given there are bookmarks in the database', () => {
      const testBookmarks = makeBookmarksArray();

      beforeEach('insert bookmarks', () => {
        return db 
          .into('bookmarks')
          .insert(testBookmarks);
      });

      it('responds with 204 and removes the bookmark', () => {
        const idToRemove = 2;
        const expectedBookmarks = testBookmarks.filter(bookmark => bookmark.id !== idToRemove);
        return supertest(app)
          .delete(`/bookmarks/${idToRemove}`)
          .expect(204)
          .then(res => 
            supertest(app)
              .get('/bookmarks')
              .expect(expectedBookmarks)  
          );
      });
    });
  });
});