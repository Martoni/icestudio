'use strict';

angular.module('icestudio')
    .service('compiler', ['nodeSha1', '_package',
      function(nodeSha1, _package) {

        this.generateVerilog = function(project) {
          var code = header('//');
          code += '`default_nettype none\n\n';
          code += verilogCompiler('main', project);
          return code;
        };

        this.generatePCF = function(project) {
          var code = header('#');
          code += pcfCompiler(project);
          return code;
        };

        this.generateTestbench = function(project) {
          var code = header('//');
          code += testbenchCompiler(project);
          return code;
        };

        this.generateGTKWave = function(project) {
          var code = header('[*]');
          code += gtkwaveCompiler(project);
          return code;
        };

        function header(comment) {
          var header = '';
          var date = new Date();
          header += comment + ' Code generated by Icestudio ' + _package.version + '\n';
          header += comment + ' ' + date.toUTCString() + '\n';
          header += '\n';
          return header;
        }

        function digestId(id, force) {
          if (id.indexOf('-') != -1) {
            return 'v' + nodeSha1(id).toString().substring(0, 6);
          }
          else {
            return id.replace('.', '_');
          }
        }

        function module(data) {
          var code = '';

          if (data &&
              data.name &&
              data.ports) {

            // Header

            code += 'module ';
            code += data.name;
            code += ' (';

            var params = [];
            var paramsSpace = 10 + data.name.length;

            for (var i in data.ports.in) {
              params.push('input ' + data.ports.in[i]);
            }
            for (var o in data.ports.out) {
              params.push('output ' + data.ports.out[o]);
            }

            code += params.join(',\n' + new Array(paramsSpace).join(' '));

            code += ');\n';

            // Content

            if (data.content) {

              var content = data.content.split('\n');

              content.forEach(function (element, index, array) {
                array[index] = ' ' + element;
              });

              code += content.join('\n');
            }

            // Footer

            code += '\nendmodule\n\n';
          }

          return code;
        }

        function getPorts(project) {
          var ports = {
            in: [],
            out: []
          };
          var graph = project.graph;

          for (var i in graph.blocks) {
            var block = graph.blocks[i];
            if (block.type == 'basic.input') {
              ports.in.push(digestId(block.id));
            }
            else if (block.type == 'basic.output') {
              ports.out.push(digestId(block.id));
            }
          }

          return ports;
        }

        function getContent(name, project) {
          var content = '';
          var graph = project.graph;

          // Wires

          for (var w in graph.wires) {
            content += 'wire w' + w + ';\n'
          }

          // I/O connections

          for (var w in graph.wires) {
            var wire = graph.wires[w];
            for (var i in graph.blocks) {
              var block = graph.blocks[i];
              if (block.type == 'basic.input') {
                if (wire.source.block == block.id) {
                  content += 'assign w' + w + ' = ' + digestId(block.id) + ';\n';
                }
              }
              else if (block.type == 'basic.output') {
                if (wire.target.block == block.id) {
                  content += 'assign ' + digestId(block.id) + ' = w' + w + ';\n';
                }
              }
            }
          }

          // Wires Connections

          var numWires = graph.wires.length;
          for (var i = 1; i < numWires; i++) {
            for (var j = 0; j < i; j++) {
              var wi = graph.wires[i];
              var wj = graph.wires[j];
              if (wi.source.block == wj.source.block &&
                  wi.source.port == wj.source.port) {
                content += 'assign w' + i + ' = w' + j + ';\n';
              }
            }
          }

          // Block instances

          var instances = []
          for (var b in graph.blocks) {
            var block = graph.blocks[b];
            if (block.type != 'basic.input' &&
                block.type != 'basic.output' &&
                block.type != 'basic.info') {

              var id = digestId(block.type, true);
              if (block.type == 'basic.code') {
                id += '_' + digestId(block.id);
              }
              instances.push(name + '_' + digestId(id) + ' ' + digestId(block.id) + ' (');

              // Parameters

              var params = [];
              var paramsNames = [];
              for (var w in graph.wires) {
                var param = '';
                var paramName = '';
                var wire = graph.wires[w];
                if (block.id == wire.source.block) {
                  paramName = digestId(wire.source.port);
                }
                else if (block.id == wire.target.block) {
                  paramName = digestId(wire.target.port);
                }
                if (paramName && paramsNames.indexOf(paramName) == -1) {
                  paramsNames.push(paramName);
                  param += ' .' + paramName;
                  param += '(w' + w + ')';
                  params.push(param);
                }
              }

              instances.push(params.join(',\n') + '\n);');
            }
          }
          content += instances.join('\n');

          return content;
        }

        function verilogCompiler(name, project) {
          var code = '';

          if (project &&
              project.graph) {

            // Scape dot in name

            name = digestId(name);

            // Main module

            if (name) {
              var data = {
                name: name,
                ports: getPorts(project),
                content: getContent(name, project)
              };
              code += module(data);
            }

            // Dependencies modules

            for (var d in project.deps) {
              code += verilogCompiler(name + '_' + digestId(d, true), project.deps[d]);
            }

            // Code modules

            for (var i in project.graph.blocks) {
              var block = project.graph.blocks[i];
              if (block) {
                if (block.type == 'basic.code') {
                  var data = {
                    name: name + '_' + digestId(block.type, true) + '_' + digestId(block.id),
                    ports: block.data.ports,
                    content: block.data.code
                  }
                  code += module(data);
                }
              }
            }
          }

          return code;
        }

        function pcfCompiler(project) {
          var code = '';

          for (var i in project.graph.blocks) {
            var block = project.graph.blocks[i];
            if (block.type == 'basic.input' ||
                block.type == 'basic.output') {
              code += 'set_io ';
              code += digestId(block.id);
              code += ' ';
              code += block.data.pin.value;
              code += '\n';
            }
          }

          return code;
        }

        function testbenchCompiler(project) {
          var code = '';

          code += '// Testbench template\n\n'

          code += '`default_nettype none\n';
          code += '`define DUMPSTR(x) `"x.vcd`"\n';
          code += '`timescale 10 ns / 1 ns\n\n';

          var ports = { in: [], out: [] };
          var content = '\n';

          content += '// Simulation time: 100ns (10 * 10ns)\n';
          content += 'parameter DURATION = 10;\n\n';

          var io = mainIO(project);
          var input = io[0];
          var output = io[1];

          // Input/Output
          content += '// Input/Output\n';
          for (var i in input) {
            content += 'reg ' + input[i].label + ';\n';
          }
          for (var o in output) {
            content += 'wire ' + output[o].label + ';\n';
          }

          var wires = input.concat(output);

          // Module instance
          content += '\n// Module instance\n';
          content += 'main MAIN (\n';
          var connections = [];
          for (var w in wires) {
            connections.push(' .' + wires[w].id + '(' + wires[w].label + ')');
          }
          content += connections.join(',\n');
          content += '\n);\n';

          // Clock signal
          var hasClk = false;
          for (var i in input) {
            if (input[i].label.toLowerCase() == 'input_clk') {
              hasClk = true;
              break;
            }
          }
          if (hasClk) {
            content += '\n// Clock signal\n';
            content += 'always #0.5 input_clk = ~input_clk;\n';
          }

          content += '\ninitial begin\n';
          content += ' // File were to store the simulation results\n';
          content += ' $dumpfile(`DUMPSTR(`VCD_OUTPUT));\n';
          content += ' $dumpvars(0, main_tb);\n\n';
          content += ' // TODO: initialize the registers here\n';
          content += ' // e.g. input_value = 1;\n';
          content += ' // e.g. #2 input_value = 0;\n';
          for (var i in input) {
            content += ' ' + input[i].label + ' = 0;\n';
          }
          content += '\n';
          content += ' #(DURATION) $display("End of simulation");\n';
          content += ' $finish;\n';
          content += 'end\n';

          var data = {
            name: 'main_tb',
            ports: ports,
            content: content
          };
          code += module(data);

          return code;
        }

        function gtkwaveCompiler(project) {
          var code = '';

          var io = mainIO(project);
          var input = io[0];
          var output = io[1];

          var wires = input.concat(output);
          for (var w in wires) {
            code += 'main_tb.' + wires[w].label + '\n';
          }

          return code;
        }

        function mainIO(project) {
          var input = [];
          var output = [];
          var input_unnamed = 0;
          var output_unnamed = 0;
          for (var i in project.graph.blocks) {
            var block = project.graph.blocks[i];
            if (block.type == 'basic.input') {
              if (block.data.label) {
                input.push({ id: digestId(block.id), label: 'input_' + block.data.label.replace(' ', '_') });
              }
              else {
                input.push({ id: digestId(block.id), label: 'input_' + input_unnamed.toString() });
                input_unnamed += 1;
              }
            }
            else if (block.type == 'basic.output') {
              if (block.data.label) {
                output.push({ id: digestId(block.id), label: 'output_' + block.data.label.replace(' ', '_') });
              }
              else {
                output.push({ id: digestId(block.id), label: 'output_' + output_unnamed.toString() });
                output_unnamed += 1;
              }
            }
          }

          return [input, output];
        }

    }]);
