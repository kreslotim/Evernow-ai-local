<script setup lang="ts">
import { computed } from 'vue';
import PhilosophySubmitDialog from "../components/PhilosophySubmitDialog.vue";
import { usePhilosophiesStore } from "../stores/philosophies.ts";

const philosophiesStore = usePhilosophiesStore();

const philosophies = computed(() => philosophiesStore.philosophies);
const isLoading = computed(() => philosophiesStore.isLoading);
const error = computed(() => philosophiesStore.error);

const search = computed(() => philosophiesStore.search);
const handleSearchChange = computed(() => philosophiesStore.handleSearchChange);
const page = computed(() => philosophiesStore.page);
const limit = computed(() => philosophiesStore.limit);
const total = computed(() => philosophiesStore.total);

const selectedId = computed(() => philosophiesStore.selectedId)

const handlePageChange = computed(() => philosophiesStore.handlePageChange);
const handleLimitChange = computed(() => philosophiesStore.handleLimitChange);
const fetchPhilosophies = computed(() => philosophiesStore.fetchPhilosophies);

const submitDialogVisible = computed(() => philosophiesStore.submitDialogVisible);
const closeSubmitDialog = computed(() => philosophiesStore.closeSubmitDialog);
const openSubmitDialog = computed(() => philosophiesStore.openSubmitDialog);

</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">Философия</h1>

    <!-- Фильтры и поиск -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      <div class="flex justify-between gap-4 mb-4">
        <div class="relative">
          <input
              :value="search"
@input="event => handleSearchChange((event.target as HTMLInputElement).value)"
              type="text"
              placeholder="Поиск по тексту"
              class="w-full p-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-gray-400 absolute left-3 top-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
          >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <div>
          <button @click="openSubmitDialog()" :class="[
                'relative bg-primary inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md']">
            Создать философию
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div v-if="isLoading" class="flex justify-center items-center p-10">
        <svg
            class="animate-spin h-10 w-10 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>

      <!-- Сообщение об ошибке -->
      <div v-else-if="error" class="p-6 text-center">
        <div class="text-red-500 mb-4">{{ error }}</div>
        <button @click="fetchPhilosophies" class="btn">Повторить</button>
      </div>

      <!-- Пустой результат -->
      <div v-else-if="philosophies.length === 0" class="p-10 text-center text-gray-500">Не найдено</div>

      <!-- Таблица с данными -->
      <div v-else>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 overflow-x-auto">
            <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Текст</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
            </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="philosophy in philosophies" :key="philosophy.id">
              <td class="px-6 py-4 whitespace-nowrap w-[200px]">
                {{ philosophy.id }}
              </td>
              <td class="px-6 py-4 break-all min-w-[400px]">
                {{ philosophy.text }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div class="flex gap-2 justify-end">
                  <button
                      @click="openSubmitDialog(philosophy.id)"
                      class="text-blue-600 hover:text-blue-900"
                      title="Редактировать"
                  >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                      <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

        <!-- Пагинация -->
        <div class="p-4 flex items-center justify-between border-t border-gray-200">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
                @click="handlePageChange(page - 1)"
                :disabled="page <= 1"
                :class="[
                'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
                page <= 1
                  ? 'bg-white text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
            >
              Назад
            </button>
            <button
                @click="handlePageChange(page + 1)"
                :disabled="page * limit >= total"
                :class="[
                'ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
                page * limit >= total
                  ? 'bg-white text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
            >
              Вперед
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Показано
                <span class="font-medium">{{ (page - 1) * limit + 1 }}</span>
                по
                <span class="font-medium">
                  {{ Math.min(page * limit, total) }}
                </span>
                из
                <span class="font-medium">{{ total }}</span>
                результатов
              </p>
            </div>
            <div>
              <div class="flex items-center">
                <select
                :value="limit"
                    @change="handleLimitChange(Number(($event.target as HTMLSelectElement).value))"
                    class="mr-4 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="5">5 на странице</option>
                  <option value="10">10 на странице</option>
                  <option value="20">20 на странице</option>
                  <option value="50">50 на странице</option>
                </select>

                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                      @click="handlePageChange(page - 1)"
                      :disabled="page <= 1"
                      :class="[
                      'relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium',
                      page <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50',
                    ]"
                  >
                    <span class="sr-only">Предыдущая</span>
                    <svg
                        class="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                      <path
                          fill-rule="evenodd"
                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                      />
                    </svg>
                  </button>

                  <!-- Кнопки страниц -->
                  <template v-for="pageNum in Math.ceil(total / limit)">
                    <button
                        v-if="
                        pageNum <= 3 ||
                        pageNum > Math.ceil(total / limit) - 3 ||
                        Math.abs(pageNum - page) <= 1
                      "
                        :key="pageNum"
                        @click="handlePageChange(pageNum)"
                        :class="[
                        'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                        pageNum === page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                      ]"
                    >
                      {{ pageNum }}
                    </button>
                    <span
                        v-else-if="
                        (pageNum === 4 && page > 4) ||
                        (pageNum === Math.ceil(total / limit) - 3 &&
                          page < Math.ceil(total / limit) - 3)
                      "
                        :key="'ellipsis-' + pageNum"
                        class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                    >
                      ...
                    </span>
                  </template>

                  <button
                      @click="handlePageChange(page + 1)"
                      :disabled="page * limit >= total"
                      :class="[
                      'relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium',
                      page * limit >= total
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50',
                    ]"
                  >
                    <span class="sr-only">Следующая</span>
                    <svg
                        class="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                      <path
                          fill-rule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <PhilosophySubmitDialog :id="selectedId" :visible="submitDialogVisible" v-if="submitDialogVisible" @close="closeSubmitDialog"/>
    <!-- Модальное окно редактирования пользователя -->
    <!--    <UserEditDialog-->
    <!--        v-if="editUserDialogVisible"-->
    <!--        :visible="editUserDialogVisible"-->
    <!--        :user-id="selectedUserId"-->
    <!--        @close="closeEditDialog"-->
    <!--    />-->
  </div>
</template>
