/**
 * 全局配置常量管理模块
 * 统一管理所有硬编码的魔法数字和配置参数
 */

import * as THREE from "https://esm.sh/three";

// ==================== 种子 schema ====================
export const SEED_SCHEMA = {
    VERSION: 1,
    PREFIX: 'G1',          // 编码字符串前缀，便于识别与未来迁移
    GARDEN_PREFIX: 'P',     // 花园（多植物）序列化前缀
};

// ==================== 渲染器配置 ====================
export const RENDERER_CONFIG = {
    CAMERA: {
        FOV: 50,
        NEAR: 0.1,
        FAR: 1000,
        INITIAL_POSITION: new THREE.Vector3(0, 35, 70),
        INITIAL_LOOKAT: new THREE.Vector3(0, 0, 0)
    },

    SCENE: {
        BACKGROUND_TOP: 0xeaf7d4,     // 浅绿高明度顶部
        BACKGROUND_BOTTOM: 0xfffeb9,   // 暖奶油底部
        FOG_NEAR: 120,
        FOG_FAR: 360,
        FOG_COLOR: 0xeaf7d4
    },

    LIGHTING: {
        HEMISPHERE_LIGHT: {
            SKY_COLOR: 0xeaf7d4,
            GROUND_COLOR: 0xb6cc94,
            INTENSITY: 0.9
        },
        AMBIENT_LIGHT: {
            COLOR: 0xffffff,
            INTENSITY: 0.35
        },
        DIRECTIONAL_LIGHT: {
            COLOR: 0xfff4e0,
            INTENSITY: 2.4,
            POSITION: { x: 18, y: 30, z: 16 },
            SHADOW_MAP_SIZE: 2048,
            SHADOW_BIAS: -0.0005,
            SHADOW_NORMAL_BIAS: 0.02,
            SHADOW_CAMERA: {
                TOP: 45,
                BOTTOM: -45,
                LEFT: -45,
                RIGHT: 45,
                NEAR: 0.1,
                FAR: 150
            }
        }
    },

    GROUND: {
        RADIUS: 40,
        HEIGHT: 4,
        SEGMENTS: 96,
        CENTER_COLOR: 0xcfe6b0,
        EDGE_COLOR: 0x9fb87a,
        POSITION_Y: -16,
        GLOW_RADIUS: 44,
        GLOW_COLOR: 0xd4f0b8
    },

    CONTROLS: {
        DAMPING_FACTOR: 0.08,
        MIN_DISTANCE: 12,
        MAX_DISTANCE: 240,
        MAX_POLAR_ANGLE: Math.PI / 2 - 0.02,
        AUTO_ROTATE_SPEED: 0.6,
        TARGET_LERP: 0.08
    },

    RENDERER_SETTINGS: {
        TONE_MAPPING_EXPOSURE: 1.15,
        MAX_PIXEL_RATIO: 2
    },

    MODEL_SCALING: {
        DESIRED_SIZE: 26,
        GROUND_OFFSET: 0.4
    }
};

// ==================== 生成器配置 ====================
export const GENERATOR_CONFIG = {
    SEED: {
        MIN_VALUE: 1,
        MAX_VALUE: 1e10
    },

    TREE_STRUCTURE: {
        ROOT_LENGTH: {
            BASE: 2,
            MIN_RANDOM: 9,
            MAX_RANDOM: 16
        },

        LENGTH_TO_RADIUS_RATIO: {
            MIN: 0.05,
            MAX: 0.13,
            VARIATION: { MIN: 0.8, MAX: 1.2 }
        },

        INITIAL_ORIENTATION: {
            X_RANGE: { MIN: -0.2, MAX: 0.2 },
            Y_VALUE: 1,
            Z_RANGE: { MIN: -0.2, MAX: 0.2 }
        },

        BRANCHING: {
            LEADER_LEVEL_THRESHOLD: 2,
            BRANCH_POINT_RANGE: { MIN: 0.5, MAX: 1.0 },
            TIP_BONUS_RANGE: { MIN: 0.5, MAX: 0.5 },
            RADIUS_VARIATION: { MIN: 0.85, MAX: 1.15 },
            PRUNING_LEVEL_THRESHOLD: 3,
            PRUNING_THRESHOLD: 0.4
        },

        CURVE: {
            CONTROL_POINT_1_DISTANCE: 0.25,
            CONTROL_POINT_1_VARIATION: { MIN: 0.8, MAX: 1.2 },
            CONTROL_POINT_2_POSITION: 0.75,
            CONTROL_POINT_2_VARIATION: { MIN: 0.5, MAX: 1.0 }
        },

        ORIENTATION: {
            GRAVITY_INFLUENCE: 0.4,
            PHOTO_INFLUENCE: 0.2,
            GRAVITY_THRESHOLD: 0.05,
            PHOTO_THRESHOLD: 0.001
        },

        LENGTH: {
            VARIATION: { MIN: 0.8, MAX: 1.2 }
        }
    }
};

// ==================== 几何体生成配置 ====================
export const GEOMETRY_CONFIG = {
    TUBE_MESH: {
        MIN_RADIAL_SEGMENTS: 8,
        RADIAL_SEGMENTS_MULTIPLIER: 12,
        MIN_TUBULAR_SEGMENTS: 8,
        TUBULAR_SEGMENTS_MULTIPLIER: 4,
        MIN_RADIUS: 0.01
    },

    BRANCH_STITCHING: {
        TRANSITION_DISTANCE_MULTIPLIER: 4,
        MIN_TRANSITION_SEGMENTS: 1
    },

    // 预览模式（造物滑块拖动时）降低分段以保证流畅；释放后重建全分辨率
    PREVIEW_SEGMENTS_SCALE: 0.6
};

// ==================== 参数生成配置 ====================
export const PARAMETER_CONFIG = {
    ARCHETYPE: {
        AVAILABLE_TYPES: ['tree'],
        SCALE_RANGE: { MIN: 0.5, MAX: 1.5 }
    },

    ENVIRONMENT: {
        PHOTOTROPISM: {
            X_RANGE: { MIN: -0.5, MAX: 0.5 },
            Y_VALUE: 1,
            Z_RANGE: { MIN: -0.5, MAX: 0.5 }
        },
        GRAVITROPISM_RANGE: { MIN: -1, MAX: 1 }
    },

    STRUCTURE: {
        TRUNK: {
            TAPER_RANGE: {
                MIN: { MIN: 0.7, MAX: 0.8 },
                MAX: { MIN: 0.6, MAX: 1 }
            },
            CURVINESS: { FREQUENCY: 0.5, AMPLITUDE: 0.1 }
        },
        BRANCHING: {
            LEVELS_RANGE: { MIN: 4, MAX: 6 },
            BRANCHES_PER_SPLIT: { MIN: 2, MAX: 4 },
            SPLIT_ANGLE: {
                MIN: Math.PI / 10,
                MAX: Math.PI / 4.5
            },
            LENGTH_DECAY_RANGE: { MIN: 0.6, MAX: 0.9 },
            CURVINESS: { FREQUENCY: 1.5, AMPLITUDE: 0.2 },
            ROTATION_ANGLE: {
                MIN_RANGE: { MIN: 0, MAX: Math.PI / 2 },
                MAX_RANGE: { MIN: Math.PI / 2, MAX: Math.PI }
            }
        }
    }
};

// ==================== 材质配置 ====================
export const MATERIAL_CONFIG = {
    COLORS: {
        // 浅绿主题：底部去饱和棕橄榄，顶部柔 sage
        BASE_COLOR: 0xa7a06e,  // 去饱和橄榄奶油
        TIP_COLOR: 0x9fc77a    // 柔 sage 绿
    },

    PROPERTIES: {
        BASE_ROUGHNESS: 0.55,
        ROUGHNESS_VARIATION: 0.75,
        METALNESS: 0.0,
        GLASS_TRANSMISSION: 0.18,
        GLASS_THICKNESS: 0.5,
        GLASS_IOR: 1.3,
        GLASS_CLEARCOAT: 0.3,
        GLASS_CLEARCOAT_ROUGHNESS: 0.4
    },

    STYLES: {
        STANDARD: 'standard',
        GLASS: 'glass'
    }
};

// ==================== 花园 / 生长配置 ====================
export const GARDEN_CONFIG = {
    MAX_PLANTS: 60,
    UNDO_STACK_SIZE: 50,
    GROWTH_DURATION_MS: 700,
    MAX_RESTORE_PER_FRAME: 2,
    HIGHLIGHT_SCALE: 1.04,
    HIGHLIGHT_EMISSIVE: 0x88aa66,
    PLACEMENT_HEIGHT_BIAS: 0.0
};

// ==================== UI 配置 ====================
export const UI_CONFIG = {
    ELEMENT_IDS: {
        STAGE: 'stage',
        CANVAS: 'three-canvas',
        OVERLAY: 'overlay',
        SEED_INPUT: 'seedInput',
        SEED_FORM: 'seedForm',
        MODE_TABS: 'modeTabs',
        CREATOR_PANEL: 'creatorPanel',
        SLIDERS: 'sliders',
        TOOLBAR: 'toolbar',
        TOAST: 'toast',
        HINT: 'hint'
    },

    ERROR_MESSAGES: {
        PLANT_GENERATION_FAILED: 'Error in Generating Plant:',
        DEFAULT_MODEL_FAILED: 'Error in Loading Default Model:',
        PRESENTING_DEFAULT: 'Presenting Default Plant Model'
    }
};

// ==================== 文件路径配置 ====================
export const PATHS = {
    DEFAULT_MODEL: 'data/defaultModel/glb/defaultModel.glb'
};