/**
 * 花园交互只消费模板库当前选中的描述符，不再读取造物草稿。
 * 选择、删除和撤销都保持当前镜头，避免操作后视角被强制拉走。
 */
export function createGardenController({
    store,
    sceneManager,
    gardenManager,
    selection,
    picker,
    toast,
    getPlacementDescriptor,
    createPlant
}) {
    function selectInstance(instance) {
        selection.select(instance);
        store.setSelected(instance ? instance.id : null);
    }

    function clearSelection() {
        selection.clear();
        store.setSelected(null);
    }

    function placeDescriptorAt(descriptor, x, z) {
        if (!descriptor) {
            toast.show('请先从植物库选择一个模板');
            return null;
        }
        const group = createPlant?.(descriptor.baseSeed, descriptor.params, descriptor.materialStyle || 'standard');
        if (!group) {
            toast.show('模板生成失败');
            return null;
        }
        const instance = gardenManager.placeAt(
            group,
            descriptor.baseSeed,
            descriptor.params,
            descriptor.materialStyle || 'standard',
            x,
            z
        );
        if (instance) sceneManager.wake(instance.group);
        return instance;
    }

    return {
        onPointerTap(x, y) {
            const plants = gardenManager.getAll().map(instance => instance.group);
            const hit = picker.pickPlants(x, y, plants);
            if (hit?.object?.userData?.plantId) {
                const instance = gardenManager.get(hit.object.userData.plantId);
                if (instance) {
                    selectInstance(instance);
                    sceneManager.wake(instance.group);
                    return;
                }
            }

            if (selection.get()) clearSelection();
            const ground = picker.pickGround(x, y, sceneManager.groundSurface);
            if (!ground) return;
            placeDescriptorAt(getPlacementDescriptor?.(), ground.x, ground.z);
        },

        placeAt(x, z) {
            return placeDescriptorAt(getPlacementDescriptor?.(), x, z);
        },

        onDelete() {
            const instance = selection.get();
            if (!instance) {
                toast.show('未选中植物');
                return;
            }
            gardenManager.removeById(instance.id, true);
            clearSelection();
        },

        onUndo() {
            clearSelection();
            gardenManager.undo();
        },

        onClear() {
            gardenManager.clear();
            clearSelection();
        },

        clearSelection
    };
}
