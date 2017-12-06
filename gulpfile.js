const gulp = require('gulp');
const del = require('del');

gulp.task('default', function() {
    // place code for your default task here
});

gulp.task('clean:output', function () {
    return del([
        '../output/**/*'
    ]);
});

gulp.task('default', ['clean:output']);