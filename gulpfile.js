'use strict';
const path = require('path');
const gulp = require('gulp');
const pkg = require('./package.json');
const $ = require('gulp-load-plugins')();
const gulpSequence = require('gulp-sequence');
const importOnce = require('node-sass-import-once');
const stylemod = require('gulp-style-modules');
const browserSync = require('browser-sync').create();
const gulpif = require('gulp-if');
const combiner = require('stream-combiner2');
const bump = require('gulp-bump');
const argv = require('yargs').argv;
const eslint = require('gulp-eslint');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const deletefile = require('gulp-delete-file');

let serve = {
  proxy: 'localhost:8080',
  logPrefix: `${pkg.name}`,
  notify: false,
  minify: false,
  online: true,
  delay: 2000
};

const sassOptions = {
  importer: importOnce,
  importOnce: {
    index: true,
    bower: true
  }
};

gulp.task('clean', function () {
  return gulp.src(['.tmp', 'css'], {
    read: false
  }).pipe($.clean());
});

gulp.task('replace-seed-files', () => {
  return gulp.src(['./**/polymer-webcomponent-seed*', './demo/*.html', '!./css/*'])
    .pipe(replace('polymer-webcomponent-seed', `${pkg.name}`))
    .pipe(rename(function (path) {
      if (path.basename === 'index') {
        path.dirname = '/demo';
      } else {
        path.basename = `${pkg.name}` + path.basename.substr(25);
      }
    }))
    .pipe(gulp.dest('./'));
});

gulp.task('replace-root-seed-files', () => {
  return gulp.src(['./index.html', './bower.json'])
    .pipe(replace('polymer-webcomponent-seed', `${pkg.name}`))
    .pipe(gulp.dest('./'));
});

gulp.task('delete-seed-files', () => {
  let regex = /polymer-webcomponent-seed\.*/g;
  return gulp.src(['./**/**'])
    .pipe(deletefile({
      reg: regex,
      deleteMatch: true
    }));
});

gulp.task('rename-application', function (cb) {
  gulpSequence('replace-seed-files', 'replace-root-seed-files', 'delete-seed-files', 'sass')(cb);
});

/**
 * Error handling function
 * @param err: Error object to be emitted
 */
function handleError(err) {
  console.error(err.toString());
  this.emit('end');
}

/**
 * Builds css from sass file
 * @returns {*|EventEmitter}
 */
function buildCSS() {
  return combiner.obj([
    $.sass(sassOptions),
    $.autoprefixer({
      browsers: ['last 2 versions', 'Safari 8.0'],
      cascade: false
    }),
    gulpif(!argv.debug, $.cssmin())
  ]).on('error', handleError);
}

gulp.task('sass', function () {
  return gulp.src(['./sass/*.scss'])
    .pipe(buildCSS())
    .pipe(stylemod({
      moduleId: function (file) {
        return path.basename(file.path, path.extname(file.path)) + '-styles';
      }
    }))
    .pipe(gulp.dest('css'))
    .pipe(browserSync.stream({match: 'css/*.html'}));
});

gulp.task('watch', function () {
  gulp.watch(['sass/*.scss'], ['sass']);
});

gulp.task('serve:dev', function () {
  serve.startPath = '/components/' + `${pkg.name}` + '/demo/index.html';
  browserSync.init(serve);

  gulp.watch(['css/*-styles.html', '*.html', 'js/*.js', 'demo/*.html'])
    .on('change', browserSync.reload);
  gulp.watch(['sass/*.scss'], ['sass']);
});

gulp.task('serve:docs', function () {
  serve.startPath = '/components/' + `${pkg.name}` + '/';
  browserSync.init(serve);

  gulp.watch(['css/*-styles.html', '*.html', 'js/*.js', 'demo/*.html'])
    .on('change', browserSync.reload);
  gulp.watch(['sass/*.scss'], ['sass']);
});

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!coverage/**', '!node_modules/**', '!bower_components/**'])
    .pipe(eslint())
    .pipe(eslint.format());
});

gulp.task('bump:patch', function () {
  gulp.src(['./bower.json', './package.json'])
    .pipe(bump({type: 'patch'}))
    .pipe(gulp.dest('./'));
});

gulp.task('bump:minor', function () {
  gulp.src(['./bower.json', './package.json'])
    .pipe(bump({type: 'minor'}))
    .pipe(gulp.dest('./'));
});

gulp.task('bump:major', function () {
  gulp.src(['./bower.json', './package.json'])
    .pipe(bump({type: 'major'}))
    .pipe(gulp.dest('./'));
});

gulp.task('docs', function (callback) {
  gulpSequence('clean', 'sass', 'lint', 'serve:docs')(callback);
});

gulp.task('default', function (callback) {
  gulpSequence('clean', 'sass', 'lint', 'serve:dev')(callback);
});
