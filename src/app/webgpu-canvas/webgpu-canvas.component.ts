/// <reference types="@webgpu/types" />

import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-webgpu-canvas',
  template: '<canvas #webgpuCanvas></canvas>',
})
export class WebGPUCanvasComponent implements AfterViewInit {
  @ViewChild('webgpuCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  context!: GPUCanvasContext;
  device!: GPUDevice;

  async ngAfterViewInit() {
    const shader = `
      struct Fragment {
    @builtin(position) Position : vec4<f32>
};

@group(0) @binding(0) var<uniform> renders : u32;

@vertex
fn vs_main(@location(0) pos: vec2f) -> Fragment {
    var output : Fragment;
    output.Position = vec4<f32>(pos, 0.0, 1.0);

    return output;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    let p : f32 = 500.0;
    let r = 2*abs(f32(renders)/p-floor(f32(renders)/p+0.5));
    let g = 2*abs((f32(renders)+85)/p-floor((f32(renders)+85)/p+0.5));
    let b = 2*abs((f32(renders)+170)/p-floor((f32(renders)+170)/p+0.5));
    // let r = abs(sin(f32(renders)/255));
    // let g = abs(sin(f32(renders)/255+2*3.14159/3));
    // let b = abs(sin(f32(renders)/255+4*3.14159/3));
    return vec4(r, g, b, 1);
}
    `;

    //adapter: wrapper around (physical) GPU.
    //Describes features and limits
    const adapter: GPUAdapter = <GPUAdapter>(
      await navigator.gpu?.requestAdapter()
    );
    //device: wrapper around GPU functionality
    //Function calls are made through the device
    this.device = <GPUDevice>await adapter?.requestDevice();
    //context: similar to vulkan instance (or OpenGL context)
    this.context = <GPUCanvasContext>(
      this.canvas.nativeElement.getContext('webgpu')
    );
    const format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: format,
      alphaMode: 'opaque',
    });

    // prettier-ignore
    const vertices: Float32Array = new Float32Array([
	// x, y
	 0.0, 0.0, 
	 0.0, 0.5, 
	-0.5, 0.0,
	 0.0, 0.0, 
	 0.0, 0.5, 
	 0.5, 0.0,
	 0.0, 0.0, 
	 0.0, -0.5, 
	-0.5, 0.0,
	 0.0, 0.0, 
	 0.0, -0.5, 
	 0.5, 0.0,
]);

    const vertexBuffer: GPUBuffer = this.device.createBuffer({
      label: 'Cell vertices',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/ 0, vertices);

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 8,
      attributes: [
        {
          format: 'float32x2',
          offset: 0,
          shaderLocation: 0, // Position, see vertex shader
        },
      ],
    };

    const renderCountBuffer: GPUBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const renderCount: Uint32Array = new Uint32Array([0]);

    let renders: number = 0;
    renderCount[0] = renders;

    renderCountBuffer.unmap();

    const bindGroupLayout: GPUBindGroupLayout =
      this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
            buffer: {
              type: 'uniform',
            },
          },
        ],
      });

    const bindGroup: GPUBindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: renderCountBuffer },
        },
      ],
    });

    const pipelineLayout: GPUPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline: GPURenderPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: this.device.createShaderModule({
          code: shader,
        }),
        entryPoint: 'fs_main',
        targets: [
          {
            format: format,
          },
        ],
      },
    });

    let render = () => {
      renders = renders + 1;
      //console.log(renders);
      const renderCountData = new Uint32Array([renders]);

      this.device.queue.writeBuffer(
        renderCountBuffer,
        0,
        renderCountData.buffer,
        renderCountData.byteOffset,
        renderCountData.byteLength
      );

      //command encoder: records draw commands for submission
      const commandEncoder: GPUCommandEncoder =
        this.device.createCommandEncoder();
      //texture view: image view to the color buffer in this case
      const textureView: GPUTextureView = this.context
        .getCurrentTexture()
        .createView();
      //renderpass: holds draw commands, allocated from command encoder
      const renderpass: GPURenderPassEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            clearValue: { r: 0.25, g: 0.25, b: 0.25, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      renderpass.setPipeline(pipeline);
      renderpass.setVertexBuffer(0, vertexBuffer);
      renderpass.setBindGroup(0, bindGroup);
      renderpass.draw(12, 1, 0, 0);
      renderpass.end();

      this.device.queue.submit([commandEncoder.finish()]);
      requestAnimationFrame(render);
    };

    render();
  }
}
