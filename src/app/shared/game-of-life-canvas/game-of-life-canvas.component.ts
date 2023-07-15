/// <reference types="@webgpu/types" />

import { AfterViewInit, Component, ViewChild, ElementRef, Input } from '@angular/core';

@Component({
  selector: 'app-game-of-life-canvas',
  templateUrl: './game-of-life-canvas.component.html',
  styleUrls: ['./game-of-life-canvas.component.scss'],
})
export class GameOfLifeCanvasComponent implements AfterViewInit {
  @ViewChild('gameOfLifeCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  @Input() gridWidth!: number;
  @Input() gridHeight!: number;
  @Input() updateInterval!: number;
  @Input() canvasWidth!: number;
  @Input() canvasHeight!: number;
  @Input() initialState!: number[] | number[][];
  @Input() reinitOnWindowResize: boolean = false;

  context!: GPUCanvasContext;
  device!: GPUDevice;

  async ngAfterViewInit() {
    let GRID_WIDTH = this.gridWidth || 10;
    let GRID_HEIGHT = this.gridHeight || 10;
    let UPDATE_INTERVAL = this.updateInterval || 5000;
    const WORKGROUP_SIZE = 10;

    let resizeSimulationCanvas = () => {
      this.canvas.nativeElement.width = window.innerWidth;
      this.canvas.nativeElement.height = window.innerHeight;
      GRID_HEIGHT = Math.round((GRID_WIDTH * window.innerHeight) / window.innerWidth);
      this.ngAfterViewInit();
    };

    if (this.reinitOnWindowResize) {
      this.canvas.nativeElement.width = window.innerWidth;
      this.canvas.nativeElement.height = window.innerHeight;
      GRID_HEIGHT = Math.round((GRID_WIDTH * window.innerHeight) / window.innerWidth);
      window.onresize = resizeSimulationCanvas;
    } else {
      this.canvas.nativeElement.width = this.canvasWidth || 100;
      this.canvas.nativeElement.height = this.canvasHeight || 100;
    }

    // Create an array representing the active state of each cell.
    let cellStateArray: Uint32Array = new Uint32Array(GRID_WIDTH * GRID_HEIGHT);
    // Checks if the array is number[][]
    // If valid initial state is provided use that otherwise generate a random state
    if (Array.isArray(this.initialState[0])) {
      // This is a number[][]
      let rowStartIndex = Math.ceil(GRID_HEIGHT / 2 - this.initialState.length / 2);
      let colStartIndex = Math.ceil(GRID_WIDTH / 2 - this.initialState[0].length / 2);

      for (let row = 0; row < GRID_HEIGHT; row++) {
        for (let col = 0; col < GRID_WIDTH; col++) {
          let index = row * GRID_WIDTH + col;

          if (row >= rowStartIndex && row < rowStartIndex + this.initialState.length && col >= colStartIndex && col < colStartIndex + this.initialState[0].length) {
            let initStateRow = row - rowStartIndex;
            let initStateCol = col - colStartIndex;
            cellStateArray[index] = (<number[][]>this.initialState)[initStateRow][initStateCol];
          } else {
            cellStateArray[index] = Math.random() > 0.6 ? 1 : 0;
          }
        }
      }
    } else if (this.initialState && this.initialState.length == GRID_WIDTH * GRID_HEIGHT) {
      // This is a number[]
      cellStateArray = Uint32Array.of(...(<number[]>this.initialState));
    } else {
      // Set each cell to a random state
      for (let i = 0; i < cellStateArray.length; ++i) {
        cellStateArray[i] = Math.random() > 0.6 ? 1 : 0;
      }
    }

    // WebGPU device initialization
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported on this browser.');
    }
    const adapter: GPUAdapter = <GPUAdapter>await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No appropriate GPUAdapter found.');
    }
    this.device = await adapter.requestDevice();

    // Canvas configuration
    this.context = <GPUCanvasContext>this.canvas.nativeElement.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: canvasFormat,
      alphaMode: 'opaque',
    });

    // Create the shader that will render the cells.
    const cellShaderModule: GPUShaderModule = this.device.createShaderModule({
      label: 'Cell shader',
      code: `
        struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) cell: vec2f,
			@location(1) states: f32 // 0 born, 1 living, 2 dying
          };

          @group(0) @binding(0) var<uniform> grid: vec2f;
		  @group(0) @binding(1) var<storage> prevCellState: array<u32>;
          @group(0) @binding(2) var<storage> cellState: array<u32>;
		  @group(1) @binding(0) var<uniform> time: f32;

          @vertex
          fn vertexMain(@location(0) position: vec2f,
                        @builtin(instance_index) instance: u32) -> VertexOutput {
            var output: VertexOutput;

            let i = f32(instance);
            let cell = vec2f(i % grid.x, floor(i / grid.x));
			
			var scale = 0.0;
			if(cellState[instance] == 1 && prevCellState[instance] == 0) { // Cell was just born this turn
				output.states = 0.0;
				scale = 1.0;
			}
			else if(cellState[instance] == 1 && prevCellState[instance] == 1) { // Cell remains alive this turn
				output.states = 1.0;
				scale = 1.0;
			}
			else if(cellState[instance] == 0 && prevCellState[instance] == 1) { // cell dies
				output.states = 2.0;
				scale = 1.0;
			}
			else { // cell was always dead
				scale = 0;
			}

            let cellOffset = cell / grid * 2;
            let gridPos = (position*scale+1) / grid - 1 + cellOffset;

            output.position = vec4f(gridPos, 0, 1);
            output.cell = cell / grid;
		
			
			
            return output;
          } 

          @fragment
          fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
			const PI: f32 = 3.14159265359;
			let max = vec4f(input.cell, 1.0-input.cell.x, 1);
			let min = vec4f(22.0/255,22.0/255,22.0/255,1);
			if(input.states == 0.0) { // Cell was just born
				return (0.5*cos(time*PI+PI)+0.5) * (max-min)+min;
			}
			else if(input.states == 1.0) { // Cell remains alive
				return max;
			}
			else {
				return (0.5*cos(time*PI)+0.5) * (max-min)+min;
			}
          }
        `,
    });

    // Create a buffer with the vertices for a single cell.
    //prettier-ignore
    const vertices: Float32Array = new Float32Array([
	//x		y
	-0.8, -0.8, // Triangle 1
  	 0.8, -0.8, 
  	 0.8,  0.8,
	-0.8, -0.8, // Triangle 2
  	 0.8,  0.8, 
  	-0.8,  0.8,
]);
    const vertexBuffer: GPUBuffer = this.device.createBuffer({
      label: 'Cell vertices',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, vertices); // write vertices to buffer

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 8, // 2 * float32 = 2 floats per vertex * 4 bytes fpr each float
      attributes: [
        {
          format: 'float32x2',
          offset: 0,
          shaderLocation: 0, // Position. Matches @location(0) in the @vertex shader.
        },
      ],
    };

    // Create the bind group layout and pipeline layout.
    const renderBindGroupLayout: GPUBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Cell Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {}, // Grid uniform buffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' }, // Prev cell state buffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' }, // Current Cell state buffer
        },
      ],
    });

    // Create the bind group layout and pipeline layout.
    const computeBindGroupLayout: GPUBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Cell Bind Group Layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
          buffer: {}, // Grid uniform buffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }, // Cell state input buffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }, // Cell state output buffer
        },
      ],
    });

    const time = new Float32Array([0.0]);
    const timeBuffer: GPUBuffer = this.device.createBuffer({
      label: 'time 1',
      size: time.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const timeBindGroupLayout: GPUBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
          },
        },
      ],
    });
    const timeBindGroup: GPUBindGroup = this.device.createBindGroup({
      layout: timeBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: timeBuffer },
        },
      ],
    });

    const pipelineLayout: GPUPipelineLayout = this.device.createPipelineLayout({
      label: 'Cell Pipeline Layout',
      bindGroupLayouts: [renderBindGroupLayout, timeBindGroupLayout],
    });

    // Create a pipeline that renders the cell.
    const cellPipeline: GPURenderPipeline = this.device.createRenderPipeline({
      label: 'Cell pipeline',
      layout: pipelineLayout,
      vertex: {
        module: cellShaderModule,
        entryPoint: 'vertexMain',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: cellShaderModule,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format: canvasFormat,
          },
        ],
      },
    });

    // Create the compute shader that will process the game of life simulation.
    const simulationShaderModule: GPUShaderModule = this.device.createShaderModule({
      label: 'Life simulation shader',
      code: `
          @group(0) @binding(0) var<uniform> grid: vec2f;

          @group(0) @binding(1) var<storage> cellStateIn: array<u32>;
          @group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>;

          fn cellIndex(cell: vec2u) -> u32 {
            return (cell.y % u32(grid.y)) * u32(grid.x) +
                   (cell.x % u32(grid.x));
          }

          fn cellActive(x: u32, y: u32) -> u32 {
            return cellStateIn[cellIndex(vec2(x, y))];
          }

          @compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
          fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
            // Determine how many active neighbors this cell has.
            let activeNeighbors = cellActive(cell.x+1, cell.y+1) +
                                  cellActive(cell.x+1, cell.y) +
                                  cellActive(cell.x+1, cell.y-1) +
                                  cellActive(cell.x, cell.y-1) +
                                  cellActive(cell.x-1, cell.y-1) +
                                  cellActive(cell.x-1, cell.y) +
                                  cellActive(cell.x-1, cell.y+1) +
                                  cellActive(cell.x, cell.y+1);

            let i = cellIndex(cell.xy);

            // Conway's game of life rules:
            switch activeNeighbors {
              case 2: { // Active cells with 2 neighbors stay active.
                cellStateOut[i] = cellStateIn[i];
              }
              case 3: { // Cells with 3 neighbors become or stay active.
                cellStateOut[i] = 1;
              }
              default: { // Cells with < 2 or > 3 neighbors become inactive.
                cellStateOut[i] = 0;
              }
            }
          }
        `,
    });

    const simulationPipelineLayout: GPUPipelineLayout = this.device.createPipelineLayout({
      label: 'Cell Pipeline Layout',
      bindGroupLayouts: [computeBindGroupLayout],
    });

    // Create a compute pipeline that updates the game state.
    const simulationPipeline: GPUComputePipeline = this.device.createComputePipeline({
      label: 'Simulation pipeline',
      layout: simulationPipelineLayout,
      compute: {
        module: simulationShaderModule,
        entryPoint: 'computeMain',
      },
    });

    // Create a uniform buffer that describes the grid.
    const uniformArray: Float32Array = new Float32Array([GRID_WIDTH, GRID_HEIGHT]);
    const uniformBuffer = this.device.createBuffer({
      label: 'Grid Uniforms',
      size: uniformArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

    // Create two storage buffers to hold the cell state.
    const cellStateStorage: GPUBuffer[] = [
      this.device.createBuffer({
        label: 'Cell State A',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: 'Cell State B',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: 'Cell State C',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: 'Cell State D',
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];
    this.device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

    // Create a bind group to pass the grid uniforms into the pipeline
    const bindGroups = [
      this.device.createBindGroup({
        label: 'Cell renderer bind group A',
        layout: renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[3] }, // prev
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[0] }, // current
          },
        ],
      }),
      this.device.createBindGroup({
        label: 'Cell renderer bind group B',
        layout: renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[0] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[1] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: 'Cell renderer bind group C',
        layout: renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[1] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[2] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: 'Cell renderer bind group D',
        layout: renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[2] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[3] },
          },
        ],
      }),
    ];

    // Create a bind group to pass the grid uniforms into the pipeline
    const computeBindGroups = [
      this.device.createBindGroup({
        label: 'Cell renderer bind group A',
        layout: computeBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[0] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[1] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: 'Cell renderer bind group B',
        layout: computeBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[1] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[2] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: 'Cell renderer bind group C',
        layout: computeBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[2] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[3] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: 'Cell renderer bind group D',
        layout: computeBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[3] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[0] },
          },
        ],
      }),
    ];

    // render loop init
    let renders = 0;
    let initTime = Date.now();
    let step = 0;

    const render = () => {
      let bindGroup: number = step % 4;
      let timeLeft: number = (Date.now() - initTime) / (UPDATE_INTERVAL / 2) - step;

      renders++; // Increment the renders count
      const encoder = this.device.createCommandEncoder();
      // Start a render pass
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 22 / 255, g: 22 / 255, b: 22 / 255, a: 1.0 },
            storeOp: 'store',
          },
        ],
      });

      // Draw the grid.
      pass.setPipeline(cellPipeline);
      pass.setBindGroup(0, bindGroups[bindGroup]); // Updated
      const timeData = new Float32Array([timeLeft]);
      this.device.queue.writeBuffer(timeBuffer, 0, timeData.buffer);
      pass.setBindGroup(1, timeBindGroup); // Updated!
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(vertices.length / 2, GRID_WIDTH * GRID_HEIGHT);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      requestAnimationFrame(() => {
        render();
      });
    };

    const updateGrid = () => {
      const encoder = this.device.createCommandEncoder();

      // Start a compute pass
      const computePass = encoder.beginComputePass();

      computePass.setPipeline(simulationPipeline), computePass.setBindGroup(0, computeBindGroups[step % 4]);
      const workgroupCountX = Math.ceil(GRID_WIDTH / WORKGROUP_SIZE);
      const workgroupCountY = Math.ceil(GRID_HEIGHT / WORKGROUP_SIZE);
      computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
      computePass.end();
      this.device.queue.submit([encoder.finish()]);
    };

    render();
    updateGrid();
    setInterval(() => {
      step++;
      updateGrid();
    }, UPDATE_INTERVAL / 2);
  }
}
