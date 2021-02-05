/* eslint-disable strict */
const BookmarksService = {
  getAllBookmarks(knex) {
    return knex.select('*').from('bookmarks');
  },
  getById(knex, id) {
    return knex.from('bookmarks').select('*').where('id', id).first();
  },
  insertBookmark(knex, newBookmark) {
    return knex
      .insert(newBookmark)
      .into('bookmarks')
      .returning('*')
      .then(rows => {
        return rows[0];
      });
  },
};

module.exports = BookmarksService;