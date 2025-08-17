# Architecture of GenPlant Project

## 1. 项目愿景 (Project Vision)

创建一个纯前端、无需服务器的静态网页。用户只需输入一个唯一的ID（种子），或点击“随机”按钮，就能在屏幕上生成一棵形态、色彩都独一无二、符合真实自然生长规律的精美三维植物模型。整个体验轻盈、即时且富有艺术感。

## 2. 核心理念 (Core Philosophy)

数据驱动生成 (Data-Driven Generation): 植物的一切（形态、分支、颜色）都由一个初始“种子”和一套生长“规则”唯一确定。同样的种子总能生成同样的植物。
单一职责原则 (Single Responsibility Principle): 代码的每个模块只做一件事，并把它做好。例如，有的模块只负责生成规则，有的只负责根据规则画模型，有的只负责渲染。
声明式生长 (Declarative Growth): 我们不直接去画一棵树，而是定义树的“生长规则”（比如：树干会长出分叉，分叉会变细并长出叶子），然后让程序去“模拟”这个生长过程。这正是PGC的精髓。

## 3. 系统架构图 (System Architecture Diagram)

```mermaid
    graph TD
        A[用户界面 UI] -- "输入种子/参数" --> B{主控模块};
        B -- "启动生成流程" --> C[生成核心 Generator];
        C -- "生成几何体与材质数据" --> D[渲染模块 Renderer];
        D -- "将3D对象渲染到画布" --> E[HTML Canvas];

        subgraph C [生成核心 Generator]
            C1[伪随机数生成器 PRNG]
            C2[L-System 引擎]
            C3[几何体构建器 Geometry Builder]
            C4[着色器 Shader Generator]
        end

        C1  --> C2;
        C2  --> C3;
        C3  --> C4;

```

## 4. 模块详解 (Module Breakdown)

### 4.1 用户界面UI模块 (UI Module)

职责: 提供用户交互的界面。
实现要点:

- 一个 index.html 文件。
- 一个 `<input type="text">` 元素，用于输入或显示种子ID。
- 一个 `<button>` 元素，用于触发“生成”或“随机生成”事件。
- 一个 `<canvas>` 元素，作为Three.js的渲染目标。
- （可选）一些 `<input type="range">` 元素，用于调整生长参数，如“迭代次数”、“弯曲角度”等，增加可玩性。

### 4.2 主控模块 (Main Controller Module)

职责: 项目的入口和指挥官。它不处理具体业务，只负责“初始化”和“协调”。
实现要点:

- 监听UI的“生成”按钮点击事件。
- 当按钮被点击时：
  - 从UI获取种子ID。如果没有，就随机生成一个。
  - 调用生成核心，将种子ID和参数传递过去。
  - 接收生成核心返回的植物模型数据（一个Three.js的Mesh对象）。
  - 调用渲染模块，将这个模型添加到场景中并进行渲染。
- 初始化整个Three.js场景。

### 4.3 生成核心模块 (Main Generator Module)

#### 4.3.1. 伪随机数生成器 (PRNG - Pseudo-Random Number Generator)

职责: 提供一个“可预测”的随机数源。不同于Math.random()，只要种子相同，它产生的随机数序列就永远相同。这是保证“相同ID生成相同植物”的关键。
实现要点: 可以使用一个简单的PRNG函数（如mulberry32），用种子ID初始化它。之后，植物生长过程中所有的“随机”决策（如：分支角度、长度、颜色）都向它请求随机数。

#### 4.3.2. L-System 引擎 (Lindenmayer System)

职责: 这是模拟自然生长最经典、最简单也最强大的算法。它通过一套简单的“重写规则”来生成复杂的字符串，这个字符串就是植物的“生长蓝图”。
实现要点:

- 公理 (Axiom): 生长的起点，一个初始字符串，比如 "F" (代表树干)。
- 规则 (Rules): 定义如何迭代。比如一条规则可以是 F -> F[+F]F[-F]，意思是“一根树干(F)会生长成一根更长的树干(F)，并在中间分叉，一个向左(+F)，一个向右(-F)”。
- 迭代 (Iteration): 将规则重复应用到字符串上。迭代次数越多，植物就越复杂、越成熟。
- 这个引擎的输入是公理、规则和迭代次数，输出是一个长长的指令字符串，例如 "F[+F[+F]F[-F]]F[-F[+F]F[-F]]"。PRNG可以在此阶段介入，用于选择不同的生长规则，创造更多变数。

#### 4.3.3 几何体构建器 (Geometry Builder)

职责: 翻译L-System生成的“生长蓝图”字符串，将其转换成Three.js可以理解的3D几何体（顶点、面）。
实现要点:

- 想象有一只“小海龟”在3D空间中移动。
- 逐一读取指令字符串中的每个字符：
  - F: 海龟向前移动一段距离，并留下一段圆柱体作为树枝。
  - +: 海龟向右转一个角度。
  - -: 海龟向左转一个角度。
  - [: 保存海龟当前的位置和姿态（入栈）。这通常是分叉的开始。
  - ]: 恢复海龟之前保存的位置和姿态（出栈）。这让你能回到分叉点，生长另一根树枝。
- 在海龟移动的过程中，记录下所有圆柱体（树枝）和球体（连接点）的几何信息。最终将它们合并成一个单一的BufferGeometry，这样性能最高。
- 贴图/颜色: 在创建几何体时，可以根据树枝的深度、年龄或PRNG的输出来决定它的颜色（顶点着色），从而实现从深褐色树干到嫩绿色新芽的平滑过渡。这是最简单也最高效的“贴图”方式，无需复杂的UV展开和图片纹理。


### 4.3.4 着色器生成器 (Shader Generator)

职责: 为几何体生成自定义的着色器程序，实现复杂的材质效果。
实现要点：

- 根据几何体的顶点以及面的片元数据来自动生成相关数据。
  - 漫反射颜色
  - 高光颜色
  - 透明度
  - 粗糙度
- 在生成几何体顶点与面的数据同时来生成颜色数据（或者保留为贴图）。


### 4.4 渲染模块 (Renderer Module)

职责: 设置和管理所有Three.js的渲染工作。
实现要点:

- 创建Scene（场景）、Camera（相机）、WebGLRenderer（渲染器）。
- 设置光源，比如AmbientLight（环境光）和DirectionalLight（平行光），好的光照是模型精致感的关键。
- 提供一个add(object)方法，让主控模块可以把生成的植物模型添加进来。
- 提供一个render()方法，在循环中不断重绘场景。
- （推荐）集成OrbitControls，让用户可以用鼠标方便地旋转、缩放、平移观察植物。


## 5. 数据流 (Data Flow)

1. 启动: 页面加载，Main.js初始化一个空的Renderer.js场景。
2. 交互: 用户在UI中输入"my-beautiful-plant"作为种子，点击“生成”。
3. 触发: Main.js监听到点击事件，清空旧的植物模型。
4. 生成:

- Main.js调用 Generator.generate("my-beautiful-plant")。
- Generator内部，PRNG以"my-beautiful-plant"为种子进行初始化。
- L-System引擎使用PRNG提供的随机决策，迭代生成生长指令字符串。
- Geometry Builder 解析该字符串，一步步构建出植物的BufferGeometry。
- Shader Generator 为几何体进行着色。
- Main Generator将这个几何体与一个支持顶点着色的Material组合成一个THREE.Mesh对象，并返回给Main.js。

1. 渲染: Main.js调用 Renderer.add(plantMesh)，将植物模型添加到场景中。
2. 显示: Renderer的渲染循环自动将包含新植物的场景绘制到<canvas>上。


## 文件结构（File Structure）

```bash
/GenPlant
|-- index.html              # 唯一的HTML文件
|-- style.css               # 样式文件，让界面更美观
|-- /js
|   |-- main.js             # 主控模块，应用入口
|   |-- /generator          # 核心：包含PRNG, L-System, Turtle逻辑
|   |   |-- generator.js    # 生成核心模块
|   |   |-- prng.js         # 伪随机数生成器
|   |   |-- lsystem.js      # L-System引擎
|   |   |-- geometry.js     # 几何体构建器
|   |   |-- shader.js       # 着色器生成器
|   |-- renderer.js         # Three.js场景设置与渲染
|   |-- /libs               # 存放第三方库
|       |-- three.min.js
|       |-- OrbitControls.js
```

To be continued...

