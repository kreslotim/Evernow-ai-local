<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">User Suggestions</h1>

    <!-- Filters and search -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      <div class="flex flex-col md:flex-row gap-4 mb-4">
        <div class="flex-1">
          <div class="relative">
            <input
              v-model="searchQuery"
              @input="handleSearchInput"
              type="text"
              placeholder="Search in suggestions and admin responses..."
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
        </div>
        <div>
          <select
            v-model="statusFilter"
            class="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <button
            @click="refreshOffers"
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 inline mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- Offers Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <!-- Loading spinner -->
      <div v-if="offersStore.isLoading" class="flex justify-center items-center p-10">
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

      <!-- Error message -->
      <div v-else-if="offersStore.hasError" class="p-6 text-center">
        <div class="text-red-500 mb-4">{{ offersStore.error }}</div>
        <button @click="refreshOffers" class="btn">Retry</button>
      </div>

      <!-- Empty result -->
      <div v-else-if="offersStore.isEmpty" class="p-10 text-center text-gray-500">No suggestions found</div>

      <!-- Table with data -->
      <div v-else>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suggestion
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin Response
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="offer in offersStore.offers" :key="offer.id">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div v-if="offer.user" class="text-sm text-blue-600 hover:text-blue-900">
                    @{{ offer.user.telegramUsername || offer.user.telegramId }}
                  </div>
                  <div v-else class="text-sm text-gray-500">User ID: {{ offer.userId }}</div>
                </td>
                <td class="px-6 py-4 max-w-xs">
                  <div class="text-sm text-gray-900">
                    <p class="truncate max-w-xs" :title="offer.text">{{ offer.text }}</p>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="[
                      'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                      offer.status === 'APPROVED'
                        ? 'bg-green-100 text-green-800'
                        : offer.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800',
                    ]"
                  >
                    {{ offer.status }}
                  </span>
                </td>
                <td class="px-6 py-4 max-w-xs">
                  <div class="text-sm text-gray-900">
                    <p v-if="offer.adminResponse" class="truncate max-w-xs" :title="offer.adminResponse">
                      {{ offer.adminResponse }}
                    </p>
                    <span v-else class="text-gray-400">No response</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">{{ formatDate(offer.createdAt) }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    v-if="offer.status === 'PENDING'"
                    @click="openApproveModal(offer)"
                    class="text-green-600 hover:text-green-900 inline-flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button
                    v-if="offer.status === 'PENDING'"
                    @click="openRejectModal(offer)"
                    class="text-red-600 hover:text-red-900 inline-flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                  <button
                    @click="viewOffer(offer)"
                    class="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="p-4 flex items-center justify-between border-t border-gray-200">
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              @click="handlePageChange(offersStore.filterOptions.page - 1)"
              :disabled="offersStore.filterOptions.page <= 1"
              :class="[
                'relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
                offersStore.filterOptions.page <= 1
                  ? 'bg-white text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
            >
              Previous
            </button>
            <button
              @click="handlePageChange(offersStore.filterOptions.page + 1)"
              :disabled="offersStore.filterOptions.page * offersStore.filterOptions.limit >= offersStore.totalOffers"
              :class="[
                'ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md',
                offersStore.filterOptions.page * offersStore.filterOptions.limit >= offersStore.totalOffers
                  ? 'bg-white text-gray-300 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700">
                Showing
                <span class="font-medium">{{
                  (offersStore.filterOptions.page - 1) * offersStore.filterOptions.limit + 1
                }}</span>
                to
                <span class="font-medium">
                  {{
                    Math.min(offersStore.filterOptions.page * offersStore.filterOptions.limit, offersStore.totalOffers)
                  }}
                </span>
                of
                <span class="font-medium">{{ offersStore.totalOffers }}</span>
                results
              </p>
            </div>
            <div>
              <div class="flex items-center">
                <select
                  v-model="offersStore.filterOptions.limit"
                  @change="handleSizeChange(Number(($event.target as HTMLSelectElement).value))"
                  class="mr-4 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>

                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    @click="handlePageChange(offersStore.filterOptions.page - 1)"
                    :disabled="offersStore.filterOptions.page <= 1"
                    :class="[
                      'relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium',
                      offersStore.filterOptions.page <= 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50',
                    ]"
                  >
                    <span class="sr-only">Previous</span>
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

                  <!-- Page buttons -->
                  <template v-for="pageNum in offersStore.totalPages">
                    <button
                      v-if="
                        pageNum <= 3 ||
                        pageNum > offersStore.totalPages - 3 ||
                        Math.abs(pageNum - offersStore.filterOptions.page) <= 1
                      "
                      :key="pageNum"
                      @click="handlePageChange(pageNum)"
                      :class="[
                        'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                        pageNum === offersStore.filterOptions.page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                      ]"
                    >
                      {{ pageNum }}
                    </button>
                    <span
                      v-else-if="pageNum === 4 && offersStore.filterOptions.page > 6"
                      :key="`ellipsis-${pageNum}`"
                      class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                    >
                      ...
                    </span>
                  </template>

                  <button
                    @click="handlePageChange(offersStore.filterOptions.page + 1)"
                    :disabled="
                      offersStore.filterOptions.page * offersStore.filterOptions.limit >= offersStore.totalOffers
                    "
                    :class="[
                      'relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium',
                      offersStore.filterOptions.page * offersStore.filterOptions.limit >= offersStore.totalOffers
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-500 hover:bg-gray-50',
                    ]"
                  >
                    <span class="sr-only">Next</span>
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

    <!-- Approve Modal -->
    <div v-if="showApproveModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Approve Suggestion</h3>
            <button @click="closeApproveModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-2">
              <strong>User:</strong> {{ selectedOffer?.user?.telegramUsername || selectedOffer?.userId }}
            </p>
            <p class="text-sm text-gray-700 mb-4"><strong>Suggestion:</strong> {{ selectedOffer?.text }}</p>
          </div>

          <div class="mb-4">
            <label for="approveResponse" class="block text-sm font-medium text-gray-700 mb-2">
              Admin Response (Optional)
            </label>
            <textarea
              id="approveResponse"
              v-model="approveResponse"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Enter your response to the user..."
            ></textarea>
          </div>

          <div class="flex justify-end space-x-3">
            <button
              @click="closeApproveModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="confirmApprove"
              :disabled="approvingOffer"
              class="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <span v-if="approvingOffer">Approving...</span>
              <span v-else>Approve</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showRejectModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Reject Suggestion</h3>
            <button @click="closeRejectModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-2">
              <strong>User:</strong> {{ selectedOffer?.user?.telegramUsername || selectedOffer?.userId }}
            </p>
            <p class="text-sm text-gray-700 mb-4"><strong>Suggestion:</strong> {{ selectedOffer?.text }}</p>
          </div>

          <div class="mb-4">
            <label for="rejectResponse" class="block text-sm font-medium text-gray-700 mb-2">
              Admin Response (Optional)
            </label>
            <textarea
              id="rejectResponse"
              v-model="rejectResponse"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Explain why this suggestion was rejected..."
            ></textarea>
          </div>

          <div class="flex justify-end space-x-3">
            <button
              @click="closeRejectModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="confirmReject"
              :disabled="rejectingOffer"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              <span v-if="rejectingOffer">Rejecting...</span>
              <span v-else>Reject</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Modal -->
    <div v-if="showViewModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Suggestion Details</h3>
            <button @click="closeViewModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="selectedOffer" class="space-y-4">
            <div>
              <p class="text-sm font-medium text-gray-700">User:</p>
              <p class="text-sm text-gray-900">{{ selectedOffer.user?.telegramUsername || selectedOffer.userId }}</p>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Status:</p>
              <span
                :class="[
                  'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                  selectedOffer.status === 'APPROVED'
                    ? 'bg-green-100 text-green-800'
                    : selectedOffer.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800',
                ]"
              >
                {{ selectedOffer.status }}
              </span>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Suggestion:</p>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{{ selectedOffer.text }}</p>
            </div>

            <div v-if="selectedOffer.adminResponse">
              <p class="text-sm font-medium text-gray-700">Admin Response:</p>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{{ selectedOffer.adminResponse }}</p>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Created:</p>
              <p class="text-sm text-gray-900">{{ formatDate(selectedOffer.createdAt) }}</p>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Updated:</p>
              <p class="text-sm text-gray-900">{{ formatDate(selectedOffer.updatedAt) }}</p>
            </div>
          </div>

          <div class="flex justify-end mt-6">
            <button
              @click="closeViewModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showRejectModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Reject Suggestion</h3>
            <button @click="closeRejectModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-4">
            <p class="text-sm text-gray-700 mb-2">
              <strong>User:</strong> {{ selectedOffer?.user?.telegramUsername || selectedOffer?.userId }}
            </p>
            <p class="text-sm text-gray-700 mb-4"><strong>Suggestion:</strong> {{ selectedOffer?.text }}</p>
          </div>

          <div class="mb-4">
            <label for="rejectResponse" class="block text-sm font-medium text-gray-700 mb-2">
              Admin Response (Optional)
            </label>
            <textarea
              id="rejectResponse"
              v-model="rejectResponse"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Explain why this suggestion was rejected..."
            ></textarea>
          </div>

          <div class="flex justify-end space-x-3">
            <button
              @click="closeRejectModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="confirmReject"
              :disabled="rejectingOffer"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              <span v-if="rejectingOffer">Rejecting...</span>
              <span v-else>Reject</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- View Modal -->
    <div v-if="showViewModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Suggestion Details</h3>
            <button @click="closeViewModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="selectedOffer" class="space-y-4">
            <div>
              <p class="text-sm font-medium text-gray-700">User:</p>
              <p class="text-sm text-gray-900">{{ selectedOffer.user?.telegramUsername || selectedOffer.userId }}</p>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Status:</p>
              <span
                :class="[
                  'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                  selectedOffer.status === 'APPROVED'
                    ? 'bg-green-100 text-green-800'
                    : selectedOffer.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800',
                ]"
              >
                {{ selectedOffer.status }}
              </span>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Suggestion:</p>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{{ selectedOffer.text }}</p>
            </div>

            <div v-if="selectedOffer.adminResponse">
              <p class="text-sm font-medium text-gray-700">Admin Response:</p>
              <p class="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">{{ selectedOffer.adminResponse }}</p>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Created:</p>
              <p class="text-sm text-gray-900">{{ formatDate(selectedOffer.createdAt) }}</p>
            </div>

            <div>
              <p class="text-sm font-medium text-gray-700">Updated:</p>
              <p class="text-sm text-gray-900">{{ formatDate(selectedOffer.updatedAt) }}</p>
            </div>
          </div>

          <div class="flex justify-end mt-6">
            <button
              @click="closeViewModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useOffersStore } from '../stores/offers';
import type { Offer } from '../types';

// Store
const offersStore = useOffersStore();

// Component state
const searchQuery = ref('');
const searchTimeout = ref<number | null>(null);
const statusFilter = ref('PENDING'); // Default to pending offers

// Modal state
const showApproveModal = ref(false);
const showRejectModal = ref(false);
const showViewModal = ref(false);
const selectedOffer = ref<Offer | null>(null);
const approveResponse = ref('');
const rejectResponse = ref('');
const approvingOffer = ref(false);
const rejectingOffer = ref(false);

// Initialize component
onMounted(() => {
  // Set default filter to PENDING
  offersStore.setStatusFilter('PENDING');
  fetchOffers();
});

// Fetch offers
const fetchOffers = async () => {
  await offersStore.fetchOffers();
};

// Refresh offers
const refreshOffers = async () => {
  await fetchOffers();
};

// Handle search input with debouncing
const handleSearchInput = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  searchTimeout.value = setTimeout(() => {
    offersStore.setSearch(searchQuery.value);
    fetchOffers();
  }, 500) as unknown as number;
};

// Handle status filter change
watch(statusFilter, (newStatus) => {
  offersStore.setStatusFilter(newStatus);
  fetchOffers();
});

// Handle page change
const handlePageChange = (page: number) => {
  offersStore.setPage(page);
  fetchOffers();
};

// Handle page size change
const handleSizeChange = (size: number) => {
  offersStore.setPageSize(size);
  fetchOffers();
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Modal functions
const openApproveModal = (offer: Offer) => {
  selectedOffer.value = offer;
  approveResponse.value = '';
  showApproveModal.value = true;
};

const closeApproveModal = () => {
  showApproveModal.value = false;
  selectedOffer.value = null;
  approveResponse.value = '';
  approvingOffer.value = false;
};

const openRejectModal = (offer: Offer) => {
  selectedOffer.value = offer;
  rejectResponse.value = '';
  showRejectModal.value = true;
};

const closeRejectModal = () => {
  showRejectModal.value = false;
  selectedOffer.value = null;
  rejectResponse.value = '';
  rejectingOffer.value = false;
};

const viewOffer = (offer: Offer) => {
  selectedOffer.value = offer;
  showViewModal.value = true;
};

const closeViewModal = () => {
  showViewModal.value = false;
  selectedOffer.value = null;
};

// Confirm approve
const confirmApprove = async () => {
  if (!selectedOffer.value) return;

  approvingOffer.value = true;
  try {
    await offersStore.approveOffer(selectedOffer.value.id, approveResponse.value || undefined);
    closeApproveModal();
    // Success feedback could be added here
  } catch (error) {
    // Error is handled by the store
    console.error('Failed to approve offer:', error);
  } finally {
    approvingOffer.value = false;
  }
};

// Confirm reject
const confirmReject = async () => {
  if (!selectedOffer.value) return;

  rejectingOffer.value = true;
  try {
    await offersStore.rejectOffer(selectedOffer.value.id, rejectResponse.value || undefined);
    closeRejectModal();
    // Success feedback could be added here
  } catch (error) {
    // Error is handled by the store
    console.error('Failed to reject offer:', error);
  } finally {
    rejectingOffer.value = false;
  }
};

// Cleanup on unmount
onBeforeUnmount(() => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }
});
</script>

<style scoped>
.btn {
  @apply bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded;
}
</style>
