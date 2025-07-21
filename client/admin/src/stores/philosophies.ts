import {defineStore} from "pinia";
import {onMounted, Ref, ref, watch} from "vue";
import {FindPhilosophiesDto, Philosophy} from "../types";
import {philosophiesApi} from "../api";

export const usePhilosophiesStore = defineStore('philosophies', () => {
    const philosophies: Ref<Philosophy[]> = ref<Philosophy[]>([]);
    const totalData: Ref<number> = ref<number>(0);
    const page: Ref<number> = ref<number>(1);
    const limit: Ref<number> = ref<number>(10);
    const isLoading: Ref<boolean> = ref<boolean>(false);
    const error: Ref<string> = ref<string>('');
    const search: Ref<string> = ref<string>('');
    const selectedId: Ref<string | null> = ref<string | null>(null);
    const submitDialogVisible: Ref<boolean> = ref<boolean>(false);


    const fetchPhilosophies = async (): Promise<void> => {
        const dto: FindPhilosophiesDto = {
            page: page.value,
            limit: limit.value,
            search: search.value
        }
        const {items, total} = await philosophiesApi.findAll(dto);

        philosophies.value = items;
        totalData.value = total;
    }

    const handlePageChange = (pageNumber: number) => {
        page.value = pageNumber;
    }

    const handleLimitChange = (limitSize: number) => {
        limit.value = limitSize;
    }

    const closeSubmitDialog = () => {
        submitDialogVisible.value = false;
    }

    const openSubmitDialog = (id?: string) => {
        selectedId.value = id || null;
        submitDialogVisible.value = true;
    }

    const handleSearchChange = (value: string) => {
        search.value = value;
    }

    watch(() => page.value, async () => {
        await fetchPhilosophies();
    })

    watch([limit, search], async () => {
        page.value = 1;
        await fetchPhilosophies();
    })

    onMounted(async () => {
        await fetchPhilosophies();
    })


    return {
        philosophies,
        total: totalData,
        page,
        limit,
        handleLimitChange,
        handlePageChange,
        isLoading,
        error,
        fetchPhilosophies,
        search,
        selectedId,
        submitDialogVisible,
        closeSubmitDialog,
        openSubmitDialog,
        handleSearchChange
    }
})