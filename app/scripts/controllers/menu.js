'use strict';

angular.module('icestudio')
  .controller('MenuCtrl', function ($rootScope,
                                    $scope,
                                    $timeout,
                                    nodeLangInfo,
                                    nodeFs,
                                    nodePath,
                                    common,
                                    graph,
                                    tools,
                                    boards,
                                    resources,
                                    profile,
                                    gui,
                                    utils,
                                    gettextCatalog,
                                    _package) {

    // Initialize scope

    $scope.common = common;
    $scope.boards = boards;
    $scope.profile = profile;

    $scope.examples = resources.getExamples();
    $scope.templates = resources.getTemplates();
    $scope.currentBoards = boards.getBoards();
    $scope.menuBlocks = resources.getMenuBlocks();

    $scope.version = _package.version;
    $scope.toolchain = tools.toolchain;

    $scope.workingdir = '';
    $scope.snapshotdir = '';
    $scope.currentProjectPath = '';

    // Configure window
    var win = gui.Window.get();
    win.on('close', function() {
      this.hide();
      profile.save();
      this.close(true);
    });

    // Darwin fix for shortcuts
    if (process.platform === 'darwin') {
      var mb = new gui.Menu({type: 'menubar'});
      mb.createMacBuiltin('Icestudio');
      win.menu = mb;
    }

    function pathSync() {
      if ($scope.currentProjectPath) {
        var projectPath = utils.dirname($scope.currentProjectPath);
        tools.setProjectPath(projectPath);
        common.setProjectPath(projectPath);
      }
    }

    // Menu

    var timer;

    // mouseover event
    $scope.showMenu = function (menu) {
      $timeout.cancel(timer);
      $scope.status[menu] = true;
    };

    // mouseleave event
    $scope.hideMenu = function (menu) {
      timer = $timeout(function () {
          $scope.status[menu] = false;
      }, 500);
    };

    // File

    $scope.newProject = function() {
      alertify.prompt(gettextCatalog.getString('Enter the project\'s title'),
                      gettextCatalog.getString('untitled'),
        function(evt, name) {
          if (name) {
            common.newProject(name);
            $scope.currentProjectPath = '';
            pathSync();
          }
      });
    }

    $scope.openProject = function() {
      setTimeout(function() {
        var ctrl = angular.element('#input-open-project');
        ctrl.on('change', function(event) {
          var file = event.target.files[0];
          event.target.files.clear();
          if (file) {
            if (file.path.endsWith('.ice')) {
              $scope.workingdir = utils.dirname(file.path) + utils.sep;
              if (!graph.isEmpty()) {
                alertify.confirm(gettextCatalog.getString('The current project will be removed. Do you want to continue loading the project?'),
                  function() {
                    common.openProject(file.path);
                    $scope.currentProjectPath = file.path;
                    pathSync();
                });
              }
              else {
                common.openProject(file.path);
                $scope.currentProjectPath = file.path;
                pathSync();
              }

            }
          }
        });
        ctrl.click();
      }, 0);
    }

    $scope.openStoredProject = function(name, project) {
      if (project) {
        if (!graph.isEmpty()) {
          alertify.confirm(gettextCatalog.getString('The current project will be removed. Do you want to continue loading the project?'),
          function() {
            common.loadProject(name, project);
            $scope.currentProjectPath = '';
            pathSync();
          });
        }
        else {
          common.loadProject(name, project);
          $scope.currentProjectPath = '';
          pathSync();
        }
      }
    }

    $scope.saveProject = function() {
      var filepath = $scope.currentProjectPath;
      if (filepath) {
        common.saveProject(filepath);
      }
      else {
        $scope.saveProjectAs();
      }
    }

    $scope.saveProjectAs = function(localCallback) {
      utils.saveDialog('#input-save-project', '.ice', function(filepath) {
        $scope.workingdir = utils.dirname(filepath) + utils.sep;
        common.saveProject(filepath);
        $scope.currentProjectPath = filepath;
        pathSync();
        if (localCallback)
          localCallback();
      });
    }

    $rootScope.$on('saveProjectAs', function(event, callback) {
      $scope.saveProjectAs(callback);
    })

    $scope.importBlock = function() {
      setTimeout(function() {
        var ctrl = angular.element('#input-import-block');
        ctrl.on('change', function(event) {
          var files = JSON.parse(JSON.stringify(event.target.files));
          for (var i in files) {
            if (files[i] &&
                files[i].path &&
                files[i].path.endsWith('.iceb')) {
              common.importBlock(files[i].path);
            }
          }
          event.target.files.clear();
        });
        ctrl.click();
      }, 0);
    }

    $scope.exportAsBlock = function() {
      checkGraph(function() {
        utils.saveDialog('#input-export-block', '.iceb', function(filepath) {
          $scope.workingdir = utils.dirname(filepath) + utils.sep;
          common.exportAsBlock(filepath);
        });
      });
    }

    $scope.exportVerilog = function() {
      checkGraph(function() {
        utils.saveDialog('#input-export-verilog', '.v', function(filepath) {
          $scope.workingdir = utils.dirname(filepath) + utils.sep;
          common.exportVerilog(filepath);
        });
      });
    }

    $scope.exportPCF = function() {
      checkGraph(function() {
        utils.saveDialog('#input-export-pcf', '.pcf', function(filepath) {
          $scope.workingdir = utils.dirname(filepath) + utils.sep;
          common.exportPCF(filepath);
        });
      });
    }

    $scope.exportTestbench = function() {
      checkGraph(function() {
        utils.saveDialog('#input-export-testbench', '.v', function(filepath) {
          $scope.workingdir = utils.dirname(filepath) + utils.sep;
          common.exportTestbench(filepath);
        });
      });
    }

    $scope.exportGTKwave = function() {
      checkGraph(function() {
        utils.saveDialog('#input-export-gtkwave', '.gtkw', function(filepath) {
          $scope.workingdir = utils.dirname(filepath) + utils.sep;
          common.exportGTKWave(filepath);
        });
      });
    }

    // Edit

    $scope.setImagePath = function() {
      var current = common.project.image;
      alertify.prompt(gettextCatalog.getString('Enter the project\'s image path'), (current) ? current : '',
        function(evt, imagePath) {
          common.setImagePath(imagePath);
      });
    }

    $scope.setRemoteHostname = function() {
      var current = profile.data.remoteHostname;
      alertify.prompt(gettextCatalog.getString('Enter the remote hostname user@host (experimental)'), (current) ? current : '',
        function(evt, remoteHostname) {
          profile.data.remoteHostname = remoteHostname;
      });
    }

    $scope.selectLanguage = function(language) {
      if (profile.data.language != language) {
        profile.data.language = language;
        utils.setLocale(language);
      }
    }

    $scope.clearGraph = function() {
      checkGraph(function() {
        alertify.confirm(gettextCatalog.getString('Do you want to clear all?'),
        function() {
          common.clearProject();
        });
      });
    }

    $scope.cloneSelected = function() {
      common.cloneSelected();
    }

    $scope.removeSelected = function() {
      if (graph.hasSelection()) {
        alertify.confirm(gettextCatalog.getString('Do you want to remove the selected block?'),
          function() {
            common.removeSelected();
        });
      }
    }

    // Key events

    var promptShown = false;

    alertify.prompt().set({
      onshow: function() {
        promptShown = true;
      },
      onclose: function() {
        promptShown = false;
      }
    });

    $(document).on('keydown', function(event) {
      if (graph.isEnabled() && !promptShown) {
        if (event.keyCode == 46 || // Supr
            (event.keyCode == 88 && event.ctrlKey)) { // Ctrl + x
          $scope.removeSelected();
        }
        else if (event.keyCode == 67 && event.ctrlKey) { // Ctrl + c
          $scope.cloneSelected();
        }
        if (process.platform === 'darwin') {
          if (event.keyCode == 8) { // Back
            $scope.removeSelected();
          }
        }
      }
      if (event.keyCode == 80 && event.ctrlKey) { // Ctrl + p
        // Print and save a window snapshot
        takeSnapshot();
      }
    });

    function takeSnapshot() {
      win.capturePage(function(img) {
        var base64Data = img.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        saveSnapshot(base64Data);
      }, 'png');
    }

    function saveSnapshot(base64Data) {
      utils.saveDialog('#input-save-snapshot', '.png', function(filepath) {
        nodeFs.writeFile(filepath, base64Data, 'base64', function (err) {
          $scope.snapshotdir = utils.dirname(filepath) + utils.sep;
          $scope.$apply();
          if (!err) alertify.success(gettextCatalog.getString('Image {{name}} saved', { name: utils.bold(utils.basename(filepath)) }));
          else throw err;
        });
      });
    }

    // View

    $scope.resetState = function() {
      graph.resetState();
    }

    $scope.showPCF = function() {
      gui.Window.open('resources/viewers/plain/pcf.html?board=' + boards.selectedBoard.name, {
        title: boards.selectedBoard.info.label + ' - PCF',
        focus: true,
        toolbar: false,
        resizable: true,
        width: 700,
        height: 700,
        icon: 'resources/images/icestudio-logo.png'
      });
    }

    $scope.showPinout = function() {
      var board = boards.selectedBoard;
      if (nodeFs.existsSync(nodePath.join('resources', 'boards', board.name, 'pinout.svg'))) {
        gui.Window.open('resources/viewers/svg/pinout.html?board=' + board.name, {
          title: boards.selectedBoard.info.label + ' - Pinout',
          focus: true,
          toolbar: false,
          resizable: true,
          width: 500,
          height: 700,
          icon: 'resources/images/icestudio-logo.png'
        });
      }
      else {
        alertify.notify(gettextCatalog.getString('{{board}} pinout not defined',  { board: utils.bold(board.info.label) }), 'warning', 5);
      }
    }

    $scope.showDatasheet = function() {
      var board = boards.selectedBoard;
      if (board.info.datasheet) {
        gui.Shell.openExternal(board.info.datasheet);
      }
      else {
        alertify.notify(gettextCatalog.getString('{{board}} datasheet not defined', { board: utils.bold(board.info.label) }), 'error', 5);
      }
    }

    // Boards

    $scope.selectBoard = function(board) {
      if (boards.selectedBoard.name != board.name) {
        if (!graph.isEmpty()) {
          alertify.confirm(gettextCatalog.getString('The current FPGA I/O configuration will be lost. Do you want to change to {{name}} board?', { name: utils.bold(board.info.label) }),
            function() {
              boards.selectBoard(board.name);
              graph.resetIOChoices();
              alertify.success(gettextCatalog.getString('Board {{name}} selected', { name: utils.bold(board.info.label) }));
              $rootScope.$apply();
          });
        }
        else {
          boards.selectBoard(board.name);
          graph.resetIOChoices();
          alertify.success(gettextCatalog.getString('Board {{name}} selected',  { name: utils.bold(board.info.label) }));
        }
      }
    }

    // Tools

    $scope.verifyCode = function() {
      checkGraph(function() {
        tools.verifyCode();
      });
    }

    $scope.buildCode = function() {
      checkGraph(function() {
        tools.buildCode();
      });
    }

    $scope.uploadCode = function() {
      checkGraph(function() {
        tools.uploadCode();
      });
    }

    function checkGraph(callback) {
      if (!graph.isEmpty()) {
        if (callback)
          callback();
      }
      else {
        alertify.notify(gettextCatalog.getString('Add a block to start'), 'warning', 5);
      }
    }

    $scope.installToolchain = function() {
      tools.installToolchain();
    }

    $scope.updateToolchain = function() {
      tools.updateToolchain();
    }

    $scope.removeToolchain = function() {
      tools.removeToolchain();
    }

    $scope.resetToolchain = function() {
      tools.resetToolchain();
    }

    $scope.enableDrivers = function() {
      tools.enableDrivers();
    }

    $scope.disableDrivers = function() {
      tools.disableDrivers();
    }

    // Help

    $scope.openUrl = function(url) {
      /*gui.Window.open(url, {
        nodejs: false,
        "new-instance": false
      });*/
      event.preventDefault();
      gui.Shell.openExternal(url);
    }

    $scope.about = function() {
      var content = [
        '<div class="row">',
        '  <div class="col-sm-4">',
        '   <img src="resources/images/fpgawars-logo.png">',
        '  </div>',
        '  <div class="col-sm-7" style="margin-left: 20px;">',
        '    <h4>Icestudio</h4>',
        '    <p><i>Graphic editor for open FPGAs</i></p>',
        '    <p>Version: ' + $scope.version + '</p>',
        '    <p>License: GPL v2</p>',
        '    <p>Created by Jesús Arroyo Torrens</p>',
        '    <p><span class="copyleft">&copy;</span> FPGAwars 2016</p>',
        '  </div>',
        '</div>'].join('\n');
      alertify.alert(content);
    }
  });
