var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var mkdirp = require('mkdirp');
var Q = require('q');

function findTool(envVar, localPath, name, suffix) {
	var toolingPath = process.env[envVar];
	return toolingPath
		? '"' + path.join(toolingPath, localPath, name + (process.platform === 'win32' ? suffix : '')) + '"'
		: name;
}

function Qexec(command) {
	var future = Q.defer();

	console.log('Executing ' + command);
	cp.exec(command, function (err, stdout, stderr) {
		if (err) {
			future.reject(err);
		}
		if (stdout) {
			process.stdout.write(stdout);
		}
		if (stderr) {
			process.stderr.write(stderr);
		}
		future.resolve();
	});
	return future.promise;
}


var projectDir = process.cwd();
process.chdir(path.join(projectDir, 'platforms/android/src/canvas'));

Qexec('npm install')
	.then(function () { return Qexec('grunt'); })
	.then(function () { return Qexec(findTool('ANDROID_NDK_PATH', '', 'ndk-build', '.cmd') + ' all'); })
	.then(function () { return Qexec(findTool('ANT_HOME', 'bin', 'ant', '.bat') + ' release'); })
	.then(function() {
		if (process.platform !== 'darwin') {
			return;
		}
		process.chdir(path.join(projectDir, 'platforms/ios/src'));
		return Qexec('xcodebuild -target universal -configuration Release');
	})
	.then(function () {
		process.chdir(projectDir);
		var filesToCopy = [
			['platforms/android/jniLibs/x86/libcanvas.so', 'platforms/android/src/canvas/libs/x86/libcanvas.so'],
			['platforms/android/jniLibs/armeabi-v7a/libcanvas.so', 'platforms/android/src/canvas/libs/armeabi-v7a/libcanvas.so'],
			['platforms/android/canvas.jar', 'platforms/android/src/canvas/bin/classes.jar'],
		];

		filesToCopy.forEach(function (pair) {
			mkdirp.sync(path.dirname(pair[0]));
			fs.writeFileSync(pair[0], fs.readFileSync(pair[1]));
		});
	})
	.done();
