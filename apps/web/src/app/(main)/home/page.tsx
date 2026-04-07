'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Bell, Star, Heart, ChevronRight, ChevronLeft, ArrowRight, MapPin, Gift } from 'lucide-react';
import StackBanner from '@/components/home/StackBanner';

function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 187 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M166.317 46.942C166.164 47.0616 166.043 47.2161 165.963 47.3924C164.825 49.1586 163.151 50.5126 161.186 51.255C160.298 51.5936 159.363 51.7961 158.414 51.8555C157.367 51.9379 156.314 51.8661 155.288 51.6423C153.151 51.1454 151.677 49.8709 150.825 47.8593C150.395 46.791 150.123 45.6658 150.018 44.5191C149.938 43.7556 149.902 42.9883 149.908 42.2207C149.908 38.918 149.908 35.6154 149.908 32.3127C149.898 31.9294 149.927 31.5461 149.995 31.1688C150.221 30.0719 150.846 29.0983 151.749 28.4368C152.652 27.7754 153.769 27.4733 154.882 27.5893C155.995 27.7053 157.025 28.2311 157.773 29.0645C158.52 29.898 158.932 30.9796 158.927 32.0995C158.936 32.9162 158.927 33.7344 158.927 34.551C158.927 36.3695 158.927 38.1875 158.927 40.0049C158.928 40.9066 159.065 41.8029 159.334 42.6636C159.456 43.0622 159.627 43.4443 159.842 43.8015C160.021 44.1038 160.248 44.3742 160.516 44.6017C160.896 44.9328 161.373 45.1322 161.876 45.17C162.379 45.2079 162.88 45.0823 163.306 44.8118C163.754 44.5198 164.138 44.1386 164.432 43.6919C164.999 42.843 165.375 41.8819 165.537 40.8741C165.616 40.3778 165.65 39.8754 165.639 39.3729C165.639 36.9379 165.639 34.503 165.639 32.068C165.626 30.8736 166.089 29.7231 166.924 28.8698C167.759 28.0165 168.899 27.5302 170.093 27.5178C171.286 27.5055 172.436 27.9681 173.288 28.804C174.141 29.6399 174.627 30.7805 174.639 31.9749C174.639 32.0755 174.639 32.1761 174.639 32.2752C174.639 38.3801 174.639 44.4851 174.639 50.59C174.639 51.3061 174.725 51.2055 174.039 51.207C171.657 51.207 169.275 51.207 166.893 51.207H166.644C166.315 51.207 166.311 51.207 166.309 50.8692C166.309 49.7503 166.309 48.6329 166.309 47.517L166.317 46.942Z" fill="currentColor"/>
      <path d="M90.1094 41.5927C88.3437 41.5927 86.578 41.5927 84.8124 41.5927C84.3143 41.5927 84.3623 41.6213 84.3923 42.0251C84.4175 42.7764 84.5696 43.518 84.8424 44.2184C84.9595 44.5122 85.1106 44.7913 85.2924 45.05C85.5329 45.4019 85.8437 45.7 86.2052 45.9256C86.5667 46.1512 86.971 46.2993 87.3926 46.3606C88.6694 46.5753 89.9811 46.3465 91.1099 45.7121C91.4564 45.5124 91.7901 45.2913 92.109 45.05C92.3506 44.8729 92.5966 44.7018 92.8456 44.5336C94.3457 43.5218 96.4549 44.2199 97.142 45.9763C97.4051 46.6148 97.4427 47.324 97.2485 47.9867C97.0543 48.6495 96.6399 49.2261 96.0739 49.6212C94.9012 50.4503 93.5885 51.0606 92.199 51.4227C91.0369 51.721 89.8434 51.8797 88.6437 51.8956C87.1113 51.9449 85.5792 51.7863 84.0893 51.4242C82.1166 50.9258 80.348 50.0386 78.8598 48.6304C77.6864 47.5317 76.7828 46.1764 76.2196 44.6702C74.9519 41.285 74.9145 37.8862 76.2751 34.5205C77.0528 32.5466 78.359 30.8252 80.0503 29.5456C81.7416 28.2659 83.7526 27.4774 85.8625 27.2666C87.9729 27.0332 90.1087 27.2821 92.109 27.9947C94.6188 28.8955 96.4759 30.5648 97.7031 32.9337C98.4682 34.4016 98.9467 36.0019 99.1132 37.6491C99.2527 39.0407 98.6631 40.1456 97.5215 40.9517C96.842 41.4291 96.0664 41.5927 95.2503 41.5957C94.1177 41.5957 92.9851 41.5957 91.8525 41.5957L90.1094 41.5927ZM84.6773 36.1599C84.798 36.2183 84.9343 36.2362 85.0659 36.2109H89.9098C90.4484 36.2109 90.3599 36.2019 90.2774 35.7455C90.1606 35.0189 89.8962 34.324 89.5003 33.7039C89.0368 33.0133 88.4082 32.602 87.5621 32.5479C86.7565 32.4984 86.0905 32.7551 85.5924 33.4036C85.4217 33.6302 85.2792 33.8767 85.1679 34.1377C84.976 34.5814 84.836 35.0459 84.7509 35.5218C84.7089 35.732 84.6203 35.9377 84.6773 36.1599Z" fill="currentColor"/>
      <path d="M64.5825 41.5928H59.4355C59.302 41.5928 59.1685 41.5928 59.035 41.5928C58.9015 41.5928 58.864 41.6453 58.867 41.7834C58.8835 42.7262 59.0275 43.6434 59.4505 44.4976C60.0041 45.6145 60.8892 46.2631 62.1388 46.3907C62.6523 46.4483 63.1711 46.4397 63.6824 46.3651C64.6072 46.217 65.4837 45.8517 66.2402 45.2993C66.5807 45.0591 66.9122 44.8069 67.2587 44.5757C67.5995 44.334 67.9893 44.1705 68.4004 44.0968C69.0811 44.0082 69.7717 44.1517 70.3609 44.5043C70.95 44.8568 71.4032 45.3977 71.6474 46.0397C71.8915 46.6817 71.9123 47.3873 71.7064 48.0426C71.5005 48.6979 71.0799 49.2646 70.5126 49.6513C69.2503 50.5278 67.8338 51.1573 66.3377 51.5068C65.2818 51.7464 64.2039 51.8752 63.1214 51.8911C61.7394 51.9357 60.357 51.8152 59.0035 51.5323C57.4329 51.2076 55.9421 50.5749 54.6171 49.6708C52.7074 48.3467 51.3903 46.5648 50.5922 44.391C50.2033 43.3078 49.9513 42.1802 49.8421 41.0343C49.6399 39.2052 49.8202 37.354 50.3717 35.5984C51.3648 32.4714 53.255 30.068 56.1712 28.5202C57.5174 27.8131 58.9916 27.3832 60.5066 27.2562C62.3517 27.0798 64.2135 27.2644 65.9881 27.7996C69.0034 28.7124 71.1456 30.6309 72.4552 33.4892C73.0409 34.7815 73.4249 36.1561 73.5938 37.565C73.8249 39.3965 72.5437 41.1679 70.6236 41.5192C70.2953 41.5773 69.9624 41.6055 69.629 41.6033C67.9458 41.5943 66.2637 41.5908 64.5825 41.5928ZM61.9453 36.2199H64.3455C64.4625 36.2199 64.5795 36.2199 64.695 36.2199C64.8105 36.2199 64.8315 36.1464 64.815 36.0488C64.7195 35.3706 64.5169 34.7119 64.215 34.0972C63.9771 33.5973 63.6013 33.1759 63.1319 32.8827C62.608 32.5589 61.9772 32.456 61.3777 32.5967C60.7782 32.7374 60.2589 33.1102 59.9336 33.6333C59.461 34.3839 59.275 35.2291 59.14 36.0878C59.137 36.1043 59.1378 36.1213 59.1424 36.1375C59.1469 36.1536 59.155 36.1686 59.1661 36.1811C59.1772 36.1937 59.1911 36.2036 59.2065 36.2101C59.222 36.2165 59.2388 36.2194 59.2555 36.2184C59.371 36.2259 59.488 36.2259 59.605 36.2259L61.9453 36.2199Z" fill="currentColor"/>
      <path d="M142.813 42.0887V50.593C142.813 50.7432 142.813 50.8933 142.813 51.0434C142.814 51.0639 142.811 51.0844 142.804 51.1036C142.797 51.1229 142.787 51.1405 142.773 51.1554C142.758 51.1703 142.742 51.1822 142.723 51.1903C142.704 51.1984 142.684 51.2026 142.663 51.2025C142.564 51.2025 142.464 51.2025 142.363 51.2025H134.262C133.791 51.2025 133.812 51.2416 133.812 50.7372C133.812 45.0005 133.812 39.2644 133.812 33.5287C133.812 33.3786 133.812 33.2285 133.812 33.0784C133.813 33.0533 133.809 33.0284 133.799 33.0054C133.789 32.9823 133.774 32.9617 133.756 32.9449C133.737 32.9282 133.715 32.9157 133.691 32.9084C133.667 32.9011 133.642 32.8992 133.617 32.9027C133.418 32.9027 133.218 32.9027 133.017 32.8922C132.434 32.8755 131.872 32.668 131.417 32.3015C130.963 31.9349 130.641 31.4295 130.5 30.8624C130.36 30.2954 130.409 29.6979 130.64 29.1614C130.871 28.625 131.271 28.179 131.78 27.8917C132.157 27.6747 132.584 27.5574 133.019 27.5509C133.218 27.5509 133.418 27.5509 133.619 27.5509C133.644 27.5544 133.669 27.5525 133.693 27.5451C133.717 27.5377 133.739 27.5251 133.758 27.5082C133.777 27.4913 133.791 27.4704 133.801 27.4472C133.811 27.424 133.815 27.3989 133.814 27.3737C133.814 27.2401 133.814 27.1065 133.814 26.9729C133.814 26.1067 133.814 25.239 133.814 24.3713C133.81 23.4037 133.957 22.4414 134.249 21.519C134.871 19.6035 136.13 18.2929 138.01 17.5828C139.091 17.1839 140.234 16.9806 141.387 16.9823C142.785 16.9688 144.184 16.9913 145.587 16.9748C146.294 16.9659 146.976 17.2383 147.482 17.7323C147.988 18.2262 148.277 18.9012 148.286 19.6087C148.295 20.3162 148.023 20.9983 147.53 21.5049C147.036 22.0115 146.361 22.3012 145.654 22.3101C145.338 22.3119 145.023 22.3528 144.717 22.4317C143.586 22.753 142.983 23.6627 142.849 24.6716C142.83 24.8541 142.823 25.0376 142.827 25.221C142.827 25.805 142.827 26.3889 142.827 26.9729C142.827 27.6094 142.759 27.5464 143.427 27.5479C144.142 27.5479 144.859 27.5479 145.575 27.5479C145.994 27.5392 146.408 27.634 146.782 27.8238C147.156 28.0137 147.477 28.2927 147.717 28.6363C148.334 29.492 148.427 30.4287 147.969 31.379C147.777 31.8182 147.462 32.193 147.064 32.4591C146.665 32.7251 146.198 32.8713 145.719 32.8802C144.939 32.9207 144.154 32.8937 143.371 32.8982C142.788 32.8982 142.827 32.8307 142.827 33.4266L142.813 42.0887Z" fill="currentColor"/>
      <path d="M102.763 38.687V33.5348C102.763 33.4012 102.763 33.2676 102.763 33.134C102.763 32.9464 102.721 32.9148 102.517 32.9088C102.313 32.9028 102.151 32.9088 101.968 32.8998C101.359 32.8798 100.775 32.6521 100.313 32.2544C99.851 31.8568 99.5385 31.313 99.4275 30.7133C99.3165 30.1136 99.4136 29.4939 99.7028 28.957C99.9919 28.4201 100.456 27.9982 101.017 27.7612C101.309 27.6361 101.621 27.5683 101.938 27.5615C102.138 27.5615 102.339 27.5615 102.538 27.5525C102.738 27.5435 102.763 27.5075 102.763 27.3048C102.763 26.4041 102.763 25.5033 102.763 24.6026C102.757 23.8665 102.926 23.1394 103.255 22.4814C103.684 21.6409 104.365 20.9559 105.203 20.5229C106.041 20.0898 106.994 19.9305 107.927 20.0671C108.86 20.2038 109.726 20.6297 110.405 21.2849C111.084 21.9401 111.54 22.7917 111.71 23.7199C111.764 24.0489 111.788 24.382 111.782 24.7152C111.791 25.4988 111.782 26.2825 111.782 27.0661C111.782 27.1832 111.782 27.3003 111.796 27.4159C111.797 27.4496 111.811 27.4816 111.835 27.5054C111.859 27.5291 111.891 27.5427 111.925 27.5435C112.04 27.5525 112.157 27.554 112.274 27.554H114.525C114.892 27.5459 115.257 27.6181 115.594 27.7656C115.931 27.9132 116.231 28.1324 116.475 28.4082C117.225 29.2429 117.408 30.2096 116.985 31.2425C116.812 31.718 116.499 32.1301 116.088 32.4248C115.677 32.7195 115.186 32.8829 114.681 32.8938C113.917 32.9389 113.149 32.9073 112.382 32.9133C111.742 32.9133 111.782 32.8263 111.782 33.4883C111.782 36.5733 111.806 39.6583 111.772 42.7418C111.755 44.213 112.658 45.3059 114.052 45.7007C114.469 45.8181 114.901 45.8747 115.335 45.8688C115.584 45.8688 115.834 45.8688 116.085 45.8688C116.11 45.8661 116.135 45.8691 116.158 45.8776C116.182 45.8861 116.204 45.8997 116.221 45.9176C116.239 45.9355 116.252 45.9572 116.26 45.981C116.268 46.0048 116.271 46.0301 116.268 46.055C116.268 46.121 116.268 46.1886 116.268 46.2546V50.8063C116.268 50.8904 116.268 50.973 116.268 51.0555C116.268 51.0766 116.263 51.0974 116.255 51.1167C116.247 51.1359 116.234 51.1532 116.219 51.1674C116.203 51.1815 116.185 51.1922 116.165 51.1988C116.145 51.2054 116.124 51.2078 116.103 51.2056H115.903C114.154 51.2056 112.405 51.2267 110.653 51.1981C109.47 51.1947 108.295 51.0036 107.172 50.6322C106.282 50.3442 105.465 49.8635 104.781 49.224C103.857 48.3413 103.329 47.2469 103.045 46.0205C102.849 45.141 102.754 44.2419 102.762 43.3408C102.765 41.7895 102.765 40.2383 102.763 38.687Z" fill="currentColor"/>
      <path d="M186.511 36.0015C186.511 40.8714 186.511 45.7409 186.511 50.6098C186.511 51.2808 186.585 51.2103 185.937 51.2103H178.092C177.975 51.2103 177.86 51.2103 177.743 51.2103C177.548 51.2028 177.521 51.1743 177.513 50.9701C177.513 50.853 177.513 50.7359 177.513 50.6188C177.513 40.965 177.513 31.3102 177.513 21.6544C177.491 20.7832 177.712 19.9231 178.152 19.1713C178.618 18.3943 179.307 17.7756 180.129 17.3958C180.952 17.0161 181.869 16.8928 182.762 17.0422C183.656 17.1915 184.483 17.6065 185.137 18.2332C185.791 18.8598 186.242 19.669 186.43 20.5555C186.495 20.8826 186.524 21.2158 186.517 21.5493C186.512 26.3652 186.51 31.1826 186.511 36.0015Z" fill="currentColor"/>
      <path d="M37.5056 31.8664C37.6578 31.7825 37.7835 31.6577 37.8686 31.5061C38.7276 30.3744 39.7818 29.4054 40.9814 28.6448C42.5566 27.6525 44.389 27.1466 46.2499 27.1901C47.6 27.2156 48.6681 27.7756 49.3582 28.9525C49.7719 29.6278 49.9411 30.4249 49.8373 31.2102C49.7335 31.9954 49.3631 32.7211 48.7881 33.2655C48.5032 33.5461 48.1994 33.8069 47.879 34.0461C46.6204 34.9304 45.3093 34.9469 43.9712 34.2308C43.6821 34.0633 43.4142 33.8617 43.1731 33.6303C42.8277 33.3129 42.405 33.0919 41.9475 32.9893C41.1509 32.8181 40.4653 33.0478 39.8683 33.5733C39.508 33.8987 39.2154 34.292 39.0072 34.7307C38.5995 35.5914 38.3495 36.5183 38.2691 37.4674C38.208 38.0659 38.1799 38.6673 38.1851 39.2689C38.1851 43.0719 38.1851 46.875 38.1851 50.6781C38.1851 51.2786 38.2361 51.217 37.6526 51.217H29.6568C29.1453 51.217 29.1648 51.2591 29.1648 50.7336C29.1648 45.8297 29.1648 40.9257 29.1648 36.0217C29.1648 34.5205 29.1648 33.0193 29.1648 31.5181C29.1514 30.7813 29.3232 30.0529 29.6643 29.3999C30.0986 28.5885 30.789 27.9436 31.6278 27.5659C32.4665 27.1881 33.4067 27.0987 34.3016 27.3115C35.1964 27.5243 35.9958 28.0275 36.5751 28.7425C37.1544 29.4575 37.481 30.3442 37.5041 31.2644C37.5086 31.437 37.5056 31.6187 37.5056 31.8664Z" fill="currentColor"/>
      <path d="M128.315 41.408C128.315 44.4755 128.315 47.5424 128.315 50.6089C128.315 51.286 128.381 51.2094 127.742 51.2094C125.111 51.2094 122.481 51.2094 119.851 51.2094C119.251 51.2094 119.302 51.2995 119.302 50.6389V42.2321C119.302 38.8814 119.302 35.5312 119.302 32.1815C119.302 31.1307 119.569 30.1624 120.223 29.3367C121.414 27.8355 122.982 27.2545 124.836 27.6854C126.69 28.1162 127.793 29.3367 128.229 31.1652C128.299 31.4912 128.33 31.8242 128.322 32.1575C128.313 35.24 128.311 38.3235 128.315 41.408Z" fill="currentColor"/>
      <path d="M123.796 16.9845C124.047 16.9845 124.296 16.9845 124.546 16.9845C126.149 16.95 127.904 18.1675 128.255 20.1371C128.422 21.09 128.223 22.071 127.699 22.8839C127.175 23.6968 126.364 24.2819 125.427 24.5221C125.331 24.549 125.234 24.5701 125.136 24.5852C124.293 24.687 123.44 24.6905 122.596 24.5957C121.711 24.4709 120.898 24.0404 120.297 23.3787C119.696 22.717 119.345 21.8658 119.305 20.9724C119.265 20.079 119.538 19.1997 120.077 18.4868C120.617 17.7739 121.389 17.2722 122.259 17.0686C122.517 17.008 122.782 16.9777 123.048 16.9785L123.796 16.9845Z" fill="currentColor"/>
      <path d="M11.7113 39.0726C11.6288 39.2438 11.6708 39.4284 11.6708 39.6056C11.6708 42.8081 11.6708 46.0107 11.6708 49.2133C11.6746 50.0177 11.4749 50.8099 11.0903 51.5162C10.6219 52.3703 9.89544 53.0541 9.01496 53.4697C8.13448 53.8853 7.14515 54.0114 6.18867 53.8299C5.2322 53.6485 4.35764 53.1687 3.69028 52.4594C3.02291 51.7502 2.59698 50.8477 2.47348 49.8814C2.4455 49.6502 2.43097 49.4176 2.42998 49.1848C2.42998 41.6622 2.40747 34.1396 2.43748 26.617C2.44948 23.2333 3.7201 20.3495 6.16532 18.0046C7.55445 16.673 9.1821 15.7107 10.9538 14.9781C12.7312 14.2606 14.5889 13.761 16.4863 13.4904C18.2997 13.2288 20.1296 13.0989 21.9618 13.1016C23.156 13.1113 24.2999 13.5838 25.1533 14.4197C26.0067 15.2557 26.5032 16.3902 26.5383 17.5847C26.5735 18.7793 26.1446 19.941 25.3418 20.8258C24.5391 21.7106 23.4249 22.2496 22.2333 22.3296C21.7353 22.3566 21.2357 22.3566 20.7332 22.3746C19.0339 22.4132 17.3455 22.6572 15.7047 23.1012C15.0134 23.2906 14.3441 23.5527 13.708 23.8833C13.3688 24.0619 13.0478 24.273 12.7494 24.5138C12.0489 25.0798 11.6483 25.7989 11.6543 26.7161C11.6504 26.9668 11.6624 27.2175 11.6903 27.4667C11.7821 28.1346 12.1256 28.742 12.6504 29.1646C13.2718 29.6714 13.9848 30.0536 14.7506 30.2905C15.9056 30.6756 17.1156 30.8693 18.3329 30.864C18.5655 30.864 18.798 30.8295 19.0305 30.8144C21.0302 30.6763 22.6008 31.4299 23.5849 33.1849C23.9326 33.8059 24.1315 34.4993 24.1661 35.2103C24.2007 35.9213 24.07 36.6307 23.7844 37.2826C23.4987 37.9346 23.0658 38.5113 22.5197 38.9675C21.9736 39.4237 21.3292 39.747 20.6372 39.9118C20.1988 40.0121 19.7515 40.0679 19.302 40.0784C18.2013 40.1336 17.0979 40.1035 16.0017 39.9884C14.6785 39.8384 13.3725 39.5629 12.1014 39.1657C11.9788 39.109 11.8462 39.0774 11.7113 39.0726Z" fill="#0B58FF"/>
      <path d="M6.22694 12.6505C2.97164 12.709 -0.00163967 9.99933 0.00286075 6.42193C-0.0224192 5.5875 0.120059 4.75649 0.421839 3.97821C0.723619 3.19994 1.17855 2.49026 1.75964 1.8913C2.34073 1.29233 3.03613 0.816272 3.80458 0.491385C4.57303 0.166498 5.39887 -0.00060185 6.23308 1.62877e-06C7.06729 0.000605108 7.89289 0.168898 8.66087 0.494897C9.42884 0.820895 10.1236 1.29795 10.7038 1.89776C11.284 2.49757 11.7379 3.20791 12.0386 3.98662C12.3392 4.76533 12.4805 5.59655 12.454 6.43094C12.4525 10.0038 9.50474 12.712 6.22694 12.6505Z" fill="#68DEFF"/>
    </svg>
  );
}

const MOCK_PROS = [
  { id: '1', name: '박인애', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 15, pudding: 1, image: 'https://i.pravatar.cc/300?img=1', images: ['https://i.pravatar.cc/300?img=1', 'https://i.pravatar.cc/200?img=14', 'https://i.pravatar.cc/200?img=15'], intro: '우아하고 위트있는 진행의 정석', price: 500000, experience: 13, tags: ['전국가능', '우아한', '위트있는'], available: true },
  { id: '2', name: '김서현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 142, pudding: 2, image: 'https://i.pravatar.cc/300?img=5', images: ['https://i.pravatar.cc/300?img=5', 'https://i.pravatar.cc/200?img=16', 'https://i.pravatar.cc/200?img=17'], intro: '감동과 웃음을 동시에 선사하는 웨딩 전문 MC', price: 550000, experience: 15, tags: ['서울/경기', '감동적인', '유머러스한'], available: true },
  { id: '3', name: '이하늘', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 98, pudding: 3, image: 'https://i.pravatar.cc/300?img=9', images: ['https://i.pravatar.cc/300?img=9', 'https://i.pravatar.cc/200?img=18', 'https://i.pravatar.cc/200?img=19'], intro: '섬세한 진행력으로 당신의 하루를 완성합니다', price: 450000, experience: 8, tags: ['서울/경기', '섬세한', '전문적인'], available: true },
  { id: '4', name: '정다은', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 67, pudding: 4, image: 'https://i.pravatar.cc/300?img=10', images: ['https://i.pravatar.cc/300?img=10', 'https://i.pravatar.cc/200?img=20', 'https://i.pravatar.cc/200?img=21'], intro: '격식과 유쾌함의 완벽한 밸런스', price: 480000, experience: 10, tags: ['전국가능', '격식있는', '유쾌한'], available: true },
  { id: '5', name: '최수아', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 55, pudding: 5, image: 'https://i.pravatar.cc/300?img=12', images: ['https://i.pravatar.cc/300?img=12', 'https://i.pravatar.cc/200?img=22', 'https://i.pravatar.cc/200?img=23'], intro: '따뜻한 목소리로 행사를 빛내드립니다', price: 420000, experience: 6, tags: ['전국가능', '따뜻한', '차분한'], available: false },
  { id: '6', name: '한도윤', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 89, pudding: 6, image: 'https://i.pravatar.cc/300?img=11', images: ['https://i.pravatar.cc/300?img=11', 'https://i.pravatar.cc/200?img=24', 'https://i.pravatar.cc/200?img=25'], intro: '부산 경남 지역 인기 1위 웨딩 MC', price: 400000, experience: 11, tags: ['경상권', '위트있는', '에너지넘치는'], available: true },
  { id: '7', name: '윤지민', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 120, pudding: 7, image: 'https://i.pravatar.cc/300?img=2', images: ['https://i.pravatar.cc/300?img=2', 'https://i.pravatar.cc/200?img=26', 'https://i.pravatar.cc/200?img=27'], intro: '프리미엄 웨딩 전문 사회자', price: 600000, experience: 18, tags: ['서울/경기', '프리미엄', '세련된'], available: true },
  { id: '8', name: '송예은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 43, pudding: 8, image: 'https://i.pravatar.cc/300?img=3', images: ['https://i.pravatar.cc/300?img=3', 'https://i.pravatar.cc/200?img=28', 'https://i.pravatar.cc/200?img=29'], intro: '밝고 에너지 넘치는 행사 진행자', price: 350000, experience: 4, tags: ['서울/경기', '밝은', '에너지넘치는'], available: true },
  { id: '9', name: '장민서', category: 'MC', role: '사회자', region: '충청', rating: 4.8, reviews: 76, pudding: 9, image: 'https://i.pravatar.cc/300?img=4', images: ['https://i.pravatar.cc/300?img=4', 'https://i.pravatar.cc/200?img=30', 'https://i.pravatar.cc/200?img=31'], intro: '대전 충남 지역 웨딩 MC 1위', price: 380000, experience: 9, tags: ['충청권', '친근한', '안정적인'], available: true },
  { id: '10', name: '오서진', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 201, pudding: 10, image: 'https://i.pravatar.cc/300?img=6', images: ['https://i.pravatar.cc/300?img=6', 'https://i.pravatar.cc/200?img=32', 'https://i.pravatar.cc/200?img=33'], intro: '200회 이상 진행한 베테랑 사회자', price: 700000, experience: 20, tags: ['전국가능', '베테랑', '감동적인'], available: true },
  { id: '11', name: '권나은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 38, pudding: 11, image: 'https://i.pravatar.cc/300?img=7', images: ['https://i.pravatar.cc/300?img=7', 'https://i.pravatar.cc/200?img=34', 'https://i.pravatar.cc/200?img=35'], intro: '아나운서 출신 깔끔한 진행', price: 520000, experience: 7, tags: ['서울/경기', '깔끔한', '아나운서출신'], available: true },
  { id: '12', name: '임채원', category: 'MC', role: '사회자', region: '전라', rating: 4.9, reviews: 94, pudding: 12, image: 'https://i.pravatar.cc/300?img=8', images: ['https://i.pravatar.cc/300?img=8', 'https://i.pravatar.cc/200?img=36', 'https://i.pravatar.cc/200?img=37'], intro: '호남 지역 최고 인기 웨딩 MC', price: 400000, experience: 12, tags: ['전라권', '다정한', '유머러스한'], available: false },
  { id: '13', name: '배수현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 63, pudding: 13, image: 'https://i.pravatar.cc/300?img=13', images: ['https://i.pravatar.cc/300?img=13', 'https://i.pravatar.cc/200?img=38', 'https://i.pravatar.cc/200?img=39'], intro: '기업행사 전문 MC', price: 650000, experience: 14, tags: ['서울/경기', '전문적인', '격식있는'], available: true },
  { id: '14', name: '유하영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 29, pudding: 14, image: 'https://i.pravatar.cc/300?img=15', images: ['https://i.pravatar.cc/300?img=15', 'https://i.pravatar.cc/200?img=40', 'https://i.pravatar.cc/200?img=41'], intro: '돌잔치 전문 사회자', price: 300000, experience: 3, tags: ['서울/경기', '따뜻한', '돌잔치전문'], available: true },
  { id: '15', name: '남지우', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 157, pudding: 15, image: 'https://i.pravatar.cc/300?img=16', images: ['https://i.pravatar.cc/300?img=16', 'https://i.pravatar.cc/200?img=42', 'https://i.pravatar.cc/200?img=43'], intro: '감성 웨딩의 완성, 진심을 전하는 MC', price: 550000, experience: 16, tags: ['전국가능', '감성적인', '진심어린'], available: true },
  { id: '16', name: '강예린', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 51, pudding: 16, image: 'https://i.pravatar.cc/300?img=17', images: ['https://i.pravatar.cc/300?img=17', 'https://i.pravatar.cc/200?img=44', 'https://i.pravatar.cc/200?img=45'], intro: '톡톡 튀는 진행으로 분위기 메이커', price: 380000, experience: 5, tags: ['서울/경기', '톡톡튀는', '분위기메이커'], available: true },
  { id: '17', name: '문소율', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 82, pudding: 17, image: 'https://i.pravatar.cc/300?img=18', images: ['https://i.pravatar.cc/300?img=18', 'https://i.pravatar.cc/200?img=46', 'https://i.pravatar.cc/200?img=47'], intro: '대구 경북 지역 웨딩 전문', price: 370000, experience: 9, tags: ['경상권', '우아한', '안정적인'], available: true },
  { id: '18', name: '서윤아', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 178, pudding: 18, image: 'https://i.pravatar.cc/300?img=19', images: ['https://i.pravatar.cc/300?img=19', 'https://i.pravatar.cc/200?img=48', 'https://i.pravatar.cc/200?img=49'], intro: '고급 호텔웨딩 전문 MC', price: 800000, experience: 22, tags: ['서울/경기', '프리미엄', '호텔웨딩전문'], available: false },
  { id: '19', name: '홍채린', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 46, pudding: 19, image: 'https://i.pravatar.cc/300?img=20', images: ['https://i.pravatar.cc/300?img=20', 'https://i.pravatar.cc/200?img=50', 'https://i.pravatar.cc/200?img=51'], intro: '영어 이중언어 MC, 국제결혼 전문', price: 600000, experience: 8, tags: ['전국가능', '이중언어', '국제결혼전문'], available: true },
  { id: '20', name: '안소희', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 110, pudding: 20, image: 'https://i.pravatar.cc/300?img=21', images: ['https://i.pravatar.cc/300?img=21', 'https://i.pravatar.cc/200?img=52', 'https://i.pravatar.cc/200?img=53'], intro: '웃음 가득한 행복한 웨딩 진행', price: 480000, experience: 11, tags: ['서울/경기', '유쾌한', '행복한'], available: true },
  { id: '21', name: '조하은', category: 'MC', role: '사회자', region: '충청', rating: 4.6, reviews: 34, pudding: 21, image: 'https://i.pravatar.cc/300?img=22', images: ['https://i.pravatar.cc/300?img=22', 'https://i.pravatar.cc/200?img=54', 'https://i.pravatar.cc/200?img=55'], intro: '세종 대전 지역 밀착 MC', price: 330000, experience: 4, tags: ['충청권', '친근한', '밀착형'], available: true },
  { id: '22', name: '김나영', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 73, pudding: 22, image: 'https://i.pravatar.cc/300?img=23', images: ['https://i.pravatar.cc/300?img=23', 'https://i.pravatar.cc/200?img=56', 'https://i.pravatar.cc/200?img=57'], intro: '차분하고 우아한 예식 진행', price: 500000, experience: 12, tags: ['서울/경기', '차분한', '우아한'], available: true },
  { id: '23', name: '이수빈', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 131, pudding: 23, image: 'https://i.pravatar.cc/300?img=24', images: ['https://i.pravatar.cc/300?img=24', 'https://i.pravatar.cc/200?img=58', 'https://i.pravatar.cc/200?img=59'], intro: '방송인 출신 프로페셔널 MC', price: 650000, experience: 17, tags: ['전국가능', '방송인출신', '프로페셔널'], available: true },
  { id: '24', name: '박지현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 22, pudding: 24, image: 'https://i.pravatar.cc/300?img=25', images: ['https://i.pravatar.cc/300?img=25', 'https://i.pravatar.cc/200?img=60', 'https://i.pravatar.cc/200?img=61'], intro: '소규모 웨딩 전문 아담한 진행', price: 280000, experience: 2, tags: ['서울/경기', '소규모전문', '아담한'], available: true },
  { id: '25', name: '윤서아', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 88, pudding: 25, image: 'https://i.pravatar.cc/300?img=26', images: ['https://i.pravatar.cc/300?img=26', 'https://i.pravatar.cc/200?img=62', 'https://i.pravatar.cc/200?img=63'], intro: '울산 경남 웨딩 MC 전문가', price: 380000, experience: 10, tags: ['경상권', '센스있는', '전문적인'], available: true },
  { id: '26', name: '전다인', category: 'MC', role: '사회자', region: '전국', rating: 4.7, reviews: 59, pudding: 26, image: 'https://i.pravatar.cc/300?img=27', images: ['https://i.pravatar.cc/300?img=27', 'https://i.pravatar.cc/200?img=64', 'https://i.pravatar.cc/200?img=65'], intro: '생신잔치·칠순 전문 MC', price: 350000, experience: 7, tags: ['전국가능', '공손한', '생신잔치전문'], available: true },
  { id: '27', name: '노은서', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 145, pudding: 27, image: 'https://i.pravatar.cc/300?img=28', images: ['https://i.pravatar.cc/300?img=28', 'https://i.pravatar.cc/200?img=66', 'https://i.pravatar.cc/200?img=67'], intro: '눈물과 감동이 있는 웨딩 MC', price: 520000, experience: 13, tags: ['서울/경기', '감동적인', '눈물샘자극'], available: false },
  { id: '28', name: '하지원', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 71, pudding: 28, image: 'https://i.pravatar.cc/300?img=29', images: ['https://i.pravatar.cc/300?img=29', 'https://i.pravatar.cc/200?img=68', 'https://i.pravatar.cc/200?img=69'], intro: '진정성 있는 따뜻한 사회 진행', price: 450000, experience: 9, tags: ['서울/경기', '진정성있는', '따뜻한'], available: true },
  { id: '29', name: '고유나', category: 'MC', role: '사회자', region: '제주', rating: 4.7, reviews: 41, pudding: 29, image: 'https://i.pravatar.cc/300?img=30', images: ['https://i.pravatar.cc/300?img=30', 'https://i.pravatar.cc/200?img=1', 'https://i.pravatar.cc/200?img=2'], intro: '제주도 야외웨딩 전문 MC', price: 450000, experience: 6, tags: ['제주', '야외웨딩전문', '자유로운'], available: true },
  { id: '30', name: '심보라', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 189, pudding: 30, image: 'https://i.pravatar.cc/300?img=31', images: ['https://i.pravatar.cc/300?img=31', 'https://i.pravatar.cc/200?img=3', 'https://i.pravatar.cc/200?img=4'], intro: '15년 경력의 대한민국 대표 웨딩 MC', price: 750000, experience: 15, tags: ['전국가능', '대표MC', '격식있는'], available: true },
  { id: '31', name: '류세은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 27, pudding: 31, image: 'https://i.pravatar.cc/300?img=32', images: ['https://i.pravatar.cc/300?img=32', 'https://i.pravatar.cc/200?img=5', 'https://i.pravatar.cc/200?img=6'], intro: '신선하고 트렌디한 MZ 웨딩 MC', price: 350000, experience: 3, tags: ['서울/경기', '트렌디한', 'MZ감성'], available: true },
  { id: '32', name: '탁예나', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 85, pudding: 32, image: 'https://i.pravatar.cc/300?img=33', images: ['https://i.pravatar.cc/300?img=33', 'https://i.pravatar.cc/200?img=7', 'https://i.pravatar.cc/200?img=8'], intro: '이벤트 기획부터 진행까지 올인원', price: 550000, experience: 11, tags: ['서울/경기', '올인원', '기획력있는'], available: true },
  { id: '33', name: '원서율', category: 'MC', role: '사회자', region: '전라', rating: 4.9, reviews: 97, pudding: 33, image: 'https://i.pravatar.cc/300?img=34', images: ['https://i.pravatar.cc/300?img=34', 'https://i.pravatar.cc/200?img=9', 'https://i.pravatar.cc/200?img=10'], intro: '광주 전남 최고 인기 사회자', price: 370000, experience: 10, tags: ['전라권', '인기MC', '활기찬'], available: true },
  { id: '34', name: '피수정', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, pudding: 34, image: 'https://i.pravatar.cc/300?img=35', images: ['https://i.pravatar.cc/300?img=35', 'https://i.pravatar.cc/200?img=11', 'https://i.pravatar.cc/200?img=12'], intro: '클래식한 정통 웨딩 MC', price: 480000, experience: 14, tags: ['서울/경기', '클래식한', '정통파'], available: false },
  { id: '35', name: '차은우', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 66, pudding: 35, image: 'https://i.pravatar.cc/300?img=36', images: ['https://i.pravatar.cc/300?img=36', 'https://i.pravatar.cc/200?img=13', 'https://i.pravatar.cc/200?img=14'], intro: '남성 사회자 중 최고의 선택', price: 500000, experience: 8, tags: ['전국가능', '댄디한', '카리스마'], available: true },
  { id: '36', name: '백다솜', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 31, pudding: 36, image: 'https://i.pravatar.cc/300?img=37', images: ['https://i.pravatar.cc/300?img=37', 'https://i.pravatar.cc/200?img=15', 'https://i.pravatar.cc/200?img=16'], intro: '소박하고 진심 어린 웨딩 진행', price: 300000, experience: 3, tags: ['서울/경기', '소박한', '진심어린'], available: true },
  { id: '37', name: '공하린', category: 'MC', role: '사회자', region: '강원', rating: 4.7, reviews: 39, pudding: 37, image: 'https://i.pravatar.cc/300?img=38', images: ['https://i.pravatar.cc/300?img=38', 'https://i.pravatar.cc/200?img=17', 'https://i.pravatar.cc/200?img=18'], intro: '강원도 자연 속 웨딩 전문', price: 350000, experience: 5, tags: ['강원권', '자연스러운', '편안한'], available: true },
  { id: '38', name: '양미래', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 113, pudding: 38, image: 'https://i.pravatar.cc/300?img=39', images: ['https://i.pravatar.cc/300?img=39', 'https://i.pravatar.cc/200?img=19', 'https://i.pravatar.cc/200?img=20'], intro: '유튜버 출신 재치 만점 MC', price: 580000, experience: 6, tags: ['서울/경기', '유튜버출신', '재치있는'], available: true },
  { id: '39', name: '도연수', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 79, pudding: 39, image: 'https://i.pravatar.cc/300?img=40', images: ['https://i.pravatar.cc/300?img=40', 'https://i.pravatar.cc/200?img=21', 'https://i.pravatar.cc/200?img=22'], intro: '기업 세미나·컨퍼런스 전문 MC', price: 700000, experience: 16, tags: ['전국가능', '기업행사전문', '프로페셔널'], available: true },
  { id: '40', name: '진하은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 19, pudding: 40, image: 'https://i.pravatar.cc/300?img=41', images: ['https://i.pravatar.cc/300?img=41', 'https://i.pravatar.cc/200?img=23', 'https://i.pravatar.cc/200?img=24'], intro: '신입이지만 열정 가득한 MC', price: 250000, experience: 1, tags: ['서울/경기', '열정적인', '신선한'], available: true },
  { id: '41', name: '나윤서', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 91, pudding: 41, image: 'https://i.pravatar.cc/300?img=42', images: ['https://i.pravatar.cc/300?img=42', 'https://i.pravatar.cc/200?img=25', 'https://i.pravatar.cc/200?img=26'], intro: '고품격 하우스웨딩 전문 MC', price: 530000, experience: 12, tags: ['서울/경기', '고품격', '하우스웨딩전문'], available: true },
  { id: '42', name: '채아린', category: 'MC', role: '사회자', region: '경상', rating: 4.7, reviews: 52, pudding: 42, image: 'https://i.pravatar.cc/300?img=43', images: ['https://i.pravatar.cc/300?img=43', 'https://i.pravatar.cc/200?img=27', 'https://i.pravatar.cc/200?img=28'], intro: '창원 김해 지역 밀착 웨딩 MC', price: 360000, experience: 7, tags: ['경상권', '밀착형', '꼼꼼한'], available: true },
  { id: '43', name: '민서영', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 135, pudding: 43, image: 'https://i.pravatar.cc/300?img=44', images: ['https://i.pravatar.cc/300?img=44', 'https://i.pravatar.cc/200?img=29', 'https://i.pravatar.cc/200?img=30'], intro: '중국어 가능 국제행사 MC', price: 650000, experience: 10, tags: ['전국가능', '중국어가능', '국제행사전문'], available: false },
  { id: '44', name: '라예진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 36, pudding: 44, image: 'https://i.pravatar.cc/300?img=45', images: ['https://i.pravatar.cc/300?img=45', 'https://i.pravatar.cc/200?img=31', 'https://i.pravatar.cc/200?img=32'], intro: '달콤하고 로맨틱한 웨딩 진행', price: 400000, experience: 5, tags: ['서울/경기', '로맨틱한', '달콤한'], available: true },
  { id: '45', name: '추은별', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 68, pudding: 45, image: 'https://i.pravatar.cc/300?img=46', images: ['https://i.pravatar.cc/300?img=46', 'https://i.pravatar.cc/200?img=33', 'https://i.pravatar.cc/200?img=34'], intro: '별처럼 빛나는 당신의 웨딩 파트너', price: 470000, experience: 8, tags: ['서울/경기', '빛나는', '파트너형'], available: true },
  { id: '46', name: '곽수민', category: 'MC', role: '사회자', region: '충청', rating: 4.7, reviews: 44, pudding: 46, image: 'https://i.pravatar.cc/300?img=47', images: ['https://i.pravatar.cc/300?img=47', 'https://i.pravatar.cc/200?img=35', 'https://i.pravatar.cc/200?img=36'], intro: '청주 충북 지역 사회자', price: 340000, experience: 6, tags: ['충청권', '성실한', '믿음직한'], available: true },
  { id: '47', name: '허다빈', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 167, pudding: 47, image: 'https://i.pravatar.cc/300?img=48', images: ['https://i.pravatar.cc/300?img=48', 'https://i.pravatar.cc/200?img=37', 'https://i.pravatar.cc/200?img=38'], intro: '예능감 넘치는 웨딩 엔터테이너', price: 550000, experience: 13, tags: ['서울/경기', '예능감', '엔터테이너'], available: true },
  { id: '48', name: '성유진', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 84, pudding: 48, image: 'https://i.pravatar.cc/300?img=49', images: ['https://i.pravatar.cc/300?img=49', 'https://i.pravatar.cc/200?img=39', 'https://i.pravatar.cc/200?img=40'], intro: '종교행사 전문 격식 MC', price: 450000, experience: 15, tags: ['전국가능', '종교행사전문', '경건한'], available: true },
  { id: '49', name: '마은채', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 25, pudding: 49, image: 'https://i.pravatar.cc/300?img=50', images: ['https://i.pravatar.cc/300?img=50', 'https://i.pravatar.cc/200?img=41', 'https://i.pravatar.cc/200?img=42'], intro: '가든웨딩 전문 내추럴 MC', price: 380000, experience: 4, tags: ['서울/경기', '내추럴', '가든웨딩전문'], available: true },
  { id: '50', name: '소지안', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 121, pudding: 50, image: 'https://i.pravatar.cc/300?img=51', images: ['https://i.pravatar.cc/300?img=51', 'https://i.pravatar.cc/200?img=43', 'https://i.pravatar.cc/200?img=44'], intro: '일본어 가능 다국어 MC', price: 620000, experience: 9, tags: ['전국가능', '일본어가능', '다국어MC'], available: true },
  { id: '51', name: '주하연', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 57, pudding: 51, image: 'https://i.pravatar.cc/300?img=52', images: ['https://i.pravatar.cc/300?img=52', 'https://i.pravatar.cc/200?img=45', 'https://i.pravatar.cc/200?img=46'], intro: '스몰웨딩 맞춤 아늑한 진행', price: 320000, experience: 5, tags: ['서울/경기', '스몰웨딩전문', '아늑한'], available: true },
  { id: '52', name: '변다영', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 74, pudding: 52, image: 'https://i.pravatar.cc/300?img=53', images: ['https://i.pravatar.cc/300?img=53', 'https://i.pravatar.cc/200?img=47', 'https://i.pravatar.cc/200?img=48'], intro: '포항 경주 지역 웨딩 MC', price: 350000, experience: 8, tags: ['경상권', '정감있는', '따뜻한'], available: false },
  { id: '53', name: '왕소은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 103, pudding: 53, image: 'https://i.pravatar.cc/300?img=54', images: ['https://i.pravatar.cc/300?img=54', 'https://i.pravatar.cc/200?img=49', 'https://i.pravatar.cc/200?img=50'], intro: '럭셔리 호텔 웨딩 전문가', price: 750000, experience: 18, tags: ['서울/경기', '럭셔리', '호텔웨딩전문'], available: true },
  { id: '54', name: '탁가은', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 33, pudding: 54, image: 'https://i.pravatar.cc/300?img=55', images: ['https://i.pravatar.cc/300?img=55', 'https://i.pravatar.cc/200?img=51', 'https://i.pravatar.cc/200?img=52'], intro: '축제·페스티벌 전문 MC', price: 500000, experience: 7, tags: ['전국가능', '축제전문', '흥넘치는'], available: true },
  { id: '55', name: '방서윤', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 62, pudding: 55, image: 'https://i.pravatar.cc/300?img=56', images: ['https://i.pravatar.cc/300?img=56', 'https://i.pravatar.cc/200?img=53', 'https://i.pravatar.cc/200?img=54'], intro: '모던하고 세련된 웨딩 진행', price: 490000, experience: 10, tags: ['서울/경기', '모던한', '세련된'], available: true },
  { id: '56', name: '엄지수', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 47, pudding: 56, image: 'https://i.pravatar.cc/300?img=57', images: ['https://i.pravatar.cc/300?img=57', 'https://i.pravatar.cc/200?img=55', 'https://i.pravatar.cc/200?img=56'], intro: '전주 익산 지역 웨딩 전문', price: 340000, experience: 6, tags: ['전라권', '정겨운', '친근한'], available: true },
  { id: '57', name: '금하율', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 149, pudding: 57, image: 'https://i.pravatar.cc/300?img=58', images: ['https://i.pravatar.cc/300?img=58', 'https://i.pravatar.cc/200?img=57', 'https://i.pravatar.cc/200?img=58'], intro: '아나운서 경력 10년의 정통파', price: 600000, experience: 19, tags: ['서울/경기', '아나운서출신', '정통파'], available: true },
  { id: '58', name: '석다현', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 81, pudding: 58, image: 'https://i.pravatar.cc/300?img=59', images: ['https://i.pravatar.cc/300?img=59', 'https://i.pravatar.cc/200?img=59', 'https://i.pravatar.cc/200?img=60'], intro: '감동 스토리텔링 웨딩 MC', price: 520000, experience: 11, tags: ['전국가능', '스토리텔링', '감동적인'], available: true },
  { id: '59', name: '봉유나', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.5, reviews: 18, pudding: 59, image: 'https://i.pravatar.cc/300?img=60', images: ['https://i.pravatar.cc/300?img=60', 'https://i.pravatar.cc/200?img=61', 'https://i.pravatar.cc/200?img=62'], intro: '귀여운 매력의 돌잔치 전문', price: 280000, experience: 2, tags: ['서울/경기', '귀여운', '돌잔치전문'], available: true },
  { id: '60', name: '선가영', category: 'MC', role: '사회자', region: '경상', rating: 4.7, reviews: 53, pudding: 60, image: 'https://i.pravatar.cc/300?img=61', images: ['https://i.pravatar.cc/300?img=61', 'https://i.pravatar.cc/200?img=63', 'https://i.pravatar.cc/200?img=64'], intro: '부산 해운대 웨딩홀 전문 MC', price: 400000, experience: 9, tags: ['경상권', '해운대전문', '활발한'], available: true },
  { id: '61', name: '옥채은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 70, pudding: 61, image: 'https://i.pravatar.cc/300?img=62', images: ['https://i.pravatar.cc/300?img=62', 'https://i.pravatar.cc/200?img=65', 'https://i.pravatar.cc/200?img=66'], intro: '포토웨딩·브라이덜샤워 MC', price: 430000, experience: 7, tags: ['서울/경기', '포토웨딩전문', '감각적인'], available: true },
  { id: '62', name: '주보라', category: 'MC', role: '사회자', region: '전국', rating: 5.0, reviews: 195, pudding: 62, image: 'https://i.pravatar.cc/300?img=63', images: ['https://i.pravatar.cc/300?img=63', 'https://i.pravatar.cc/200?img=67', 'https://i.pravatar.cc/200?img=68'], intro: '20년 경력 최고의 웨딩 마스터', price: 900000, experience: 20, tags: ['전국가능', '웨딩마스터', '최고경력'], available: true },
  { id: '63', name: '빈세아', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 28, pudding: 63, image: 'https://i.pravatar.cc/300?img=64', images: ['https://i.pravatar.cc/300?img=64', 'https://i.pravatar.cc/200?img=69', 'https://i.pravatar.cc/200?img=70'], intro: '힙하고 개성 있는 MZ 웨딩', price: 370000, experience: 3, tags: ['서울/경기', '힙한', '개성있는'], available: true },
  { id: '64', name: '예다솜', category: 'MC', role: '사회자', region: '충청', rating: 4.7, reviews: 42, pudding: 64, image: 'https://i.pravatar.cc/300?img=65', images: ['https://i.pravatar.cc/300?img=65', 'https://i.pravatar.cc/200?img=1', 'https://i.pravatar.cc/200?img=2'], intro: '천안 아산 지역 전문 MC', price: 330000, experience: 5, tags: ['충청권', '지역밀착', '꼼꼼한'], available: true },
  { id: '65', name: '편서하', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 126, pudding: 65, image: 'https://i.pravatar.cc/300?img=66', images: ['https://i.pravatar.cc/300?img=66', 'https://i.pravatar.cc/200?img=3', 'https://i.pravatar.cc/200?img=4'], intro: '뮤지컬 배우 출신 감성 MC', price: 580000, experience: 8, tags: ['서울/경기', '뮤지컬배우출신', '감성적인'], available: false },
  { id: '66', name: '복예원', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 77, pudding: 66, image: 'https://i.pravatar.cc/300?img=67', images: ['https://i.pravatar.cc/300?img=67', 'https://i.pravatar.cc/200?img=5', 'https://i.pravatar.cc/200?img=6'], intro: '워크숍·MT 전문 레크리에이션 MC', price: 450000, experience: 10, tags: ['전국가능', '레크리에이션', '신나는'], available: true },
  { id: '67', name: '탁서현', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 49, pudding: 67, image: 'https://i.pravatar.cc/300?img=68', images: ['https://i.pravatar.cc/300?img=68', 'https://i.pravatar.cc/200?img=7', 'https://i.pravatar.cc/200?img=8'], intro: '차분하고 지적인 진행 스타일', price: 470000, experience: 9, tags: ['서울/경기', '지적인', '차분한'], available: true },
  { id: '68', name: '국하윤', category: 'MC', role: '사회자', region: '경상', rating: 4.8, reviews: 64, pudding: 68, image: 'https://i.pravatar.cc/300?img=69', images: ['https://i.pravatar.cc/300?img=69', 'https://i.pravatar.cc/200?img=9', 'https://i.pravatar.cc/200?img=10'], intro: '경주 불국사 전통혼례 전문', price: 400000, experience: 12, tags: ['경상권', '전통혼례전문', '고풍스러운'], available: true },
  { id: '69', name: '온다연', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.6, reviews: 35, pudding: 69, image: 'https://i.pravatar.cc/300?img=70', images: ['https://i.pravatar.cc/300?img=70', 'https://i.pravatar.cc/200?img=11', 'https://i.pravatar.cc/200?img=12'], intro: '상견례·약혼식 전문 사회자', price: 350000, experience: 4, tags: ['서울/경기', '상견례전문', '예의바른'], available: true },
  { id: '70', name: '견아영', category: 'MC', role: '사회자', region: '전국', rating: 4.9, reviews: 138, pudding: 70, image: 'https://i.pravatar.cc/300?img=1', images: ['https://i.pravatar.cc/300?img=1', 'https://i.pravatar.cc/200?img=13', 'https://i.pravatar.cc/200?img=14'], intro: '한국어·영어 완벽 이중언어 MC', price: 680000, experience: 14, tags: ['전국가능', '이중언어', '글로벌'], available: true },
  { id: '71', name: '라서진', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 56, pudding: 71, image: 'https://i.pravatar.cc/300?img=2', images: ['https://i.pravatar.cc/300?img=2', 'https://i.pravatar.cc/200?img=15', 'https://i.pravatar.cc/200?img=16'], intro: '웨딩플래너 겸 사회자', price: 500000, experience: 11, tags: ['서울/경기', '웨딩플래너겸', '올인원'], available: true },
  { id: '72', name: '매수아', category: 'MC', role: '사회자', region: '제주', rating: 4.8, reviews: 45, pudding: 72, image: 'https://i.pravatar.cc/300?img=3', images: ['https://i.pravatar.cc/300?img=3', 'https://i.pravatar.cc/200?img=17', 'https://i.pravatar.cc/200?img=18'], intro: '제주 리조트웨딩 전문 MC', price: 480000, experience: 7, tags: ['제주', '리조트웨딩전문', '낭만적인'], available: true },
  { id: '73', name: '빈나은', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 99, pudding: 73, image: 'https://i.pravatar.cc/300?img=4', images: ['https://i.pravatar.cc/300?img=4', 'https://i.pravatar.cc/200?img=19', 'https://i.pravatar.cc/200?img=20'], intro: '웃음보 터지는 유쾌한 MC', price: 440000, experience: 8, tags: ['서울/경기', '유쾌한', '웃음가득'], available: true },
  { id: '74', name: '길수현', category: 'MC', role: '사회자', region: '전국', rating: 4.6, reviews: 30, pudding: 74, image: 'https://i.pravatar.cc/300?img=5', images: ['https://i.pravatar.cc/300?img=5', 'https://i.pravatar.cc/200?img=21', 'https://i.pravatar.cc/200?img=22'], intro: '군부대 행사 전문 MC', price: 350000, experience: 6, tags: ['전국가능', '군행사전문', '씩씩한'], available: true },
  { id: '75', name: '표다인', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.8, reviews: 87, pudding: 75, image: 'https://i.pravatar.cc/300?img=6', images: ['https://i.pravatar.cc/300?img=6', 'https://i.pravatar.cc/200?img=23', 'https://i.pravatar.cc/200?img=24'], intro: '연예계 시상식 출신 MC', price: 650000, experience: 15, tags: ['서울/경기', '시상식출신', '화려한'], available: false },
  { id: '76', name: '제윤아', category: 'MC', role: '사회자', region: '전라', rating: 4.7, reviews: 40, pudding: 76, image: 'https://i.pravatar.cc/300?img=7', images: ['https://i.pravatar.cc/300?img=7', 'https://i.pravatar.cc/200?img=25', 'https://i.pravatar.cc/200?img=26'], intro: '목포 여수 남도 웨딩 MC', price: 330000, experience: 5, tags: ['전라권', '남도감성', '다정한'], available: true },
  { id: '77', name: '옥서율', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.9, reviews: 115, pudding: 77, image: 'https://i.pravatar.cc/300?img=8', images: ['https://i.pravatar.cc/300?img=8', 'https://i.pravatar.cc/200?img=27', 'https://i.pravatar.cc/200?img=28'], intro: '신부 대기실부터 함께하는 밀착 MC', price: 520000, experience: 13, tags: ['서울/경기', '밀착케어', '꼼꼼한'], available: true },
  { id: '78', name: '인보미', category: 'MC', role: '사회자', region: '전국', rating: 4.8, reviews: 72, pudding: 78, image: 'https://i.pravatar.cc/300?img=9', images: ['https://i.pravatar.cc/300?img=9', 'https://i.pravatar.cc/200?img=29', 'https://i.pravatar.cc/200?img=30'], intro: '학교 행사·졸업식 전문 MC', price: 300000, experience: 7, tags: ['전국가능', '학교행사전문', '활기찬'], available: true },
  { id: '79', name: '태수연', category: 'MC', role: '사회자', region: '서울/경기', rating: 4.7, reviews: 48, pudding: 79, image: 'https://i.pravatar.cc/300?img=10', images: ['https://i.pravatar.cc/300?img=10', 'https://i.pravatar.cc/200?img=31', 'https://i.pravatar.cc/200?img=32'], intro: '품격 있는 약혼식·상견례 전문', price: 420000, experience: 9, tags: ['서울/경기', '품격있는', '약혼식전문'], available: true },
  { id: '80', name: '선예나', category: 'MC', role: '사회자', region: '서울/경기', rating: 5.0, reviews: 160, pudding: 80, image: 'https://i.pravatar.cc/300?img=11', images: ['https://i.pravatar.cc/300?img=11', 'https://i.pravatar.cc/200?img=33', 'https://i.pravatar.cc/200?img=34'], intro: '대한민국 웨딩 MC 어워드 수상자', price: 850000, experience: 21, tags: ['서울/경기', '어워드수상', '최고급'], available: true },
];

interface ReviewItem {
  nickname: string;
  avatar: string;
  rating: number;
  text: string;
}

const RANK_REVIEWS: Record<string, ReviewItem[]> = {
  '1': [
    { nickname: '행복한신부', avatar: 'https://i.pravatar.cc/40?img=31', rating: 5.0, text: '우아하면서도 위트 있는 진행 덕분에 하객들이 모두 즐거워했어요' },
    { nickname: '웨딩준비중', avatar: 'https://i.pravatar.cc/40?img=32', rating: 5.0, text: '격식과 유머의 밸런스가 완벽했어요. 다음에도 꼭 부탁드릴게요' },
    { nickname: '예비신랑J', avatar: 'https://i.pravatar.cc/40?img=33', rating: 5.0, text: '사전 미팅부터 꼼꼼하게 준비해주셔서 감동이었습니다' },
  ],
  '2': [
    { nickname: '봄날의신부', avatar: 'https://i.pravatar.cc/40?img=34', rating: 5.0, text: '감동과 웃음을 동시에, 이분 없으면 우리 결혼식 상상이 안 돼요' },
    { nickname: '하객대표', avatar: 'https://i.pravatar.cc/40?img=35', rating: 4.9, text: '하객으로 갔는데 MC분이 너무 좋아서 연락처 받아왔어요' },
    { nickname: '감동그자체', avatar: 'https://i.pravatar.cc/40?img=36', rating: 5.0, text: '부모님 감사 편지 낭독 때 온 하객이 울었어요. 진행력 최고' },
  ],
  '3': [
    { nickname: '차분한예신', avatar: 'https://i.pravatar.cc/40?img=37', rating: 5.0, text: '섬세하게 챙겨주셔서 긴장 하나도 안 했어요. 최고의 MC!' },
    { nickname: '후기남기기', avatar: 'https://i.pravatar.cc/40?img=38', rating: 4.8, text: '소통이 정말 빠르고 세심해요. 리허설도 꼼꼼하게 진행' },
    { nickname: '행복한우리', avatar: 'https://i.pravatar.cc/40?img=39', rating: 5.0, text: '자연스러운 분위기 연출이 정말 프로페셔널했습니다' },
  ],
  '4': [
    { nickname: '유쾌한커플', avatar: 'https://i.pravatar.cc/40?img=40', rating: 5.0, text: '격식도 있으면서 유쾌해서 분위기가 정말 좋았습니다' },
    { nickname: '만족100', avatar: 'https://i.pravatar.cc/40?img=41', rating: 4.9, text: '이벤트 아이디어도 직접 제안해주시고 진행도 깔끔!' },
    { nickname: '결혼축하', avatar: 'https://i.pravatar.cc/40?img=42', rating: 5.0, text: '친구 결혼식에서 보고 반해서 저도 바로 예약했어요' },
  ],
  '5': [
    { nickname: '따뜻한하루', avatar: 'https://i.pravatar.cc/40?img=43', rating: 4.8, text: '따뜻한 목소리에 하객분들이 다 감동받으셨어요' },
    { nickname: '소소한행복', avatar: 'https://i.pravatar.cc/40?img=44', rating: 4.9, text: '스몰웨딩이었는데 오히려 더 친밀한 진행이 좋았어요' },
    { nickname: '웨딩후기', avatar: 'https://i.pravatar.cc/40?img=45', rating: 5.0, text: '목소리 톤이 정말 좋으세요. 편안한 분위기를 만들어주셨어요' },
  ],
};

function RotatingReview({ proId }: { proId: string }) {
  const reviews = RANK_REVIEWS[proId] ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((prev) => (prev + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [reviews.length]);

  if (reviews.length === 0) return null;
  const review = reviews[idx];

  return (
    <div className="relative h-[52px] overflow-hidden">
      <div
        key={idx}
        className="absolute inset-0 animate-review-fade"
      >
        <div className="flex items-center gap-1 mb-1">
          <img src={review.avatar} alt="" className="w-[14px] h-[14px] rounded-full" />
          <span className="text-[10px] font-semibold text-gray-700">{review.nickname}</span>
          <Star size={9} className="fill-yellow-400 text-yellow-400 ml-0.5" />
          <span className="text-[10px] font-bold text-gray-600">{review.rating}</span>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug line-clamp-2">
          {review.text}
        </p>
      </div>
    </div>
  );
}

// Language map for foreign-language capable pros
const PRO_LANGUAGES: Record<string, string[]> = {
  '19': ['영어'],
  '39': ['영어'],
  '43': ['중국어'],
  '50': ['일본어'],
  '70': ['영어'],
  '23': ['영어', '일본어'],
  '30': ['영어', '중국어'],
  '10': ['영어'],
};

const LANGUAGE_PROS_IDS = Object.keys(PRO_LANGUAGES);
const ALL_LANGUAGES = [...new Set(Object.values(PRO_LANGUAGES).flat())];

// Event-specialist pros (by id)
const EVENT_SPECIALIST: Record<string, string> = {
  '14': '돌잔치', '59': '돌잔치',
  '26': '생신잔치',
  '13': '기업행사', '39': '기업행사',
  '29': '야외웨딩', '72': '리조트웨딩',
  '48': '종교행사',
  '78': '학교행사',
  '68': '전통혼례',
  '69': '상견례',
  '66': '워크숍/MT',
  '54': '축제/페스티벌',
};
const EVENT_SPECIALIST_IDS = Object.keys(EVENT_SPECIALIST);
const ALL_EVENT_TYPES = [...new Set(Object.values(EVENT_SPECIALIST))];

// Online status: minutes since last active (0 = currently online)
const PRO_ONLINE_STATUS: Record<string, number> = {
  '1': 0, '2': 0, '4': 3, '6': 0, '7': 0, '8': 2,
  '9': 0, '16': 0, '20': 1, '22': 0, '25': 0, '28': 3,
  '31': 0, '33': 0, '38': 2, '41': 0, '45': 0, '47': 0,
  '49': 1, '51': 0, '55': 0, '60': 3, '61': 0, '73': 0,
};

function OnlineProCard({ pro }: { pro: typeof MOCK_PROS[0] }) {
  const minutesAgo = PRO_ONLINE_STATUS[pro.id] ?? 0;
  const isNow = minutesAgo === 0;

  return (
    <Link
      href={`/pros/${pro.id}`}
      className="flex items-center gap-3 group"
    >
      {/* Circle avatar with fan-out on hover */}
      <div className="relative w-[56px] h-[56px] shrink-0 my-3 z-10">
        {/* Stacked photos behind — fan out on hover */}
        <img
          src={pro.images[2]}
          alt=""
          className="absolute w-[56px] h-[56px] rounded-full object-cover border-2 border-white shadow-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[38px] group-hover:translate-y-[-8px] group-hover:rotate-[12deg] group-hover:scale-90 z-[1]"
        />
        <img
          src={pro.images[1]}
          alt=""
          className="absolute w-[56px] h-[56px] rounded-full object-cover border-2 border-white shadow-sm transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-[50ms] group-hover:translate-x-[20px] group-hover:translate-y-[-12px] group-hover:rotate-[6deg] group-hover:scale-95 z-[2]"
        />
        {/* Main photo — stays in place */}
        <img
          src={pro.images[0]}
          alt={pro.name}
          className="absolute w-[56px] h-[56px] rounded-full object-cover border-2 border-white shadow-md z-[3] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
        />
        {/* Online indicator */}
        <span className={`absolute bottom-0 right-0 z-[4] w-3.5 h-3.5 rounded-full border-2 border-white ${isNow ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>

      {/* Info */}
      <div className="min-w-0">
        <span className="text-[11px] font-medium text-gray-400">{pro.category}</span>
        <p className="text-[14px] font-bold text-gray-900 leading-tight truncate">{pro.name}</p>
        <p className="text-[11px] mt-0.5">
          {isNow ? (
            <span className="text-green-600 font-semibold">현재 접속중</span>
          ) : (
            <span className="text-gray-400">접속 {minutesAgo}분 전</span>
          )}
        </p>
      </div>
    </Link>
  );
}

// ─── Business Partners (기업회원) ──────────────────────────────
interface BusinessPartner {
  id: string;
  category: string;
  name: string;
  location: string;
  images: string[];
  tags: string[];
  originalPrice: number;
  discountPercent: number;
}

const BIZ_CATEGORIES = ['전체', '웨딩홀', '피부과', '스튜디오', '드레스', '헤메샵', '스냅영상'];

const MOCK_BUSINESSES: BusinessPartner[] = [
  { id: 'b1', category: '웨딩홀', name: '더채플앳청담', location: '서울 강남구', images: ['https://i.pravatar.cc/300?img=50', 'https://i.pravatar.cc/300?img=51', 'https://i.pravatar.cc/300?img=52'], tags: ['우아한', '모던한', '루프탑'], originalPrice: 5000000, discountPercent: 40 },
  { id: 'b2', category: '웨딩홀', name: '그랜드하얏트 서울', location: '서울 용산구', images: ['https://i.pravatar.cc/300?img=53', 'https://i.pravatar.cc/300?img=54', 'https://i.pravatar.cc/300?img=55'], tags: ['럭셔리', '호텔', '대규모'], originalPrice: 8000000, discountPercent: 35 },
  { id: 'b3', category: '피부과', name: '글로우업 피부과', location: '서울 신사동', images: ['https://i.pravatar.cc/300?img=56', 'https://i.pravatar.cc/300?img=57', 'https://i.pravatar.cc/300?img=58'], tags: ['웨딩피부', '관리전문', '인기'], originalPrice: 1200000, discountPercent: 50 },
  { id: 'b4', category: '피부과', name: '뉴페이스 클리닉', location: '서울 압구정', images: ['https://i.pravatar.cc/300?img=59', 'https://i.pravatar.cc/300?img=60', 'https://i.pravatar.cc/300?img=61'], tags: ['프리미엄', '1:1맞춤', '피부톤업'], originalPrice: 1500000, discountPercent: 45 },
  { id: 'b5', category: '스튜디오', name: '무드스튜디오', location: '서울 성수동', images: ['https://i.pravatar.cc/300?img=62', 'https://i.pravatar.cc/300?img=63', 'https://i.pravatar.cc/300?img=64'], tags: ['감성적인', '자연광', '트렌디'], originalPrice: 2000000, discountPercent: 40 },
  { id: 'b6', category: '스튜디오', name: '아뜰리에드서울', location: '서울 삼청동', images: ['https://i.pravatar.cc/300?img=65', 'https://i.pravatar.cc/300?img=66', 'https://i.pravatar.cc/300?img=67'], tags: ['클래식', '고급스러운', '한옥배경'], originalPrice: 2500000, discountPercent: 35 },
  { id: 'b7', category: '드레스', name: '라비엔로즈', location: '서울 논현동', images: ['https://i.pravatar.cc/300?img=68', 'https://i.pravatar.cc/300?img=69', 'https://i.pravatar.cc/300?img=70'], tags: ['수입드레스', '맞춤제작', '우아한'], originalPrice: 3000000, discountPercent: 30 },
  { id: 'b8', category: '드레스', name: '모니카블랑쉬', location: '서울 청담동', images: ['https://i.pravatar.cc/300?img=1', 'https://i.pravatar.cc/300?img=2', 'https://i.pravatar.cc/300?img=3'], tags: ['디자이너', '프리미엄', '트렌디'], originalPrice: 4000000, discountPercent: 25 },
  { id: 'b9', category: '헤메샵', name: '블룸헤어메이크업', location: '서울 강남구', images: ['https://i.pravatar.cc/300?img=4', 'https://i.pravatar.cc/300?img=5', 'https://i.pravatar.cc/300?img=6'], tags: ['자연스러운', '지속력', '본식전문'], originalPrice: 800000, discountPercent: 40 },
  { id: 'b10', category: '헤메샵', name: '뷰티하우스 제이', location: '서울 서초구', images: ['https://i.pravatar.cc/300?img=7', 'https://i.pravatar.cc/300?img=8', 'https://i.pravatar.cc/300?img=9'], tags: ['셀럽담당', '꼼꼼한', '리터치포함'], originalPrice: 1000000, discountPercent: 35 },
  { id: 'b11', category: '스냅영상', name: '필름바이준', location: '서울 마포구', images: ['https://i.pravatar.cc/300?img=10', 'https://i.pravatar.cc/300?img=11', 'https://i.pravatar.cc/300?img=12'], tags: ['시네마틱', '감성영상', '당일편집'], originalPrice: 1500000, discountPercent: 40 },
  { id: 'b12', category: '스냅영상', name: '스냅바이유', location: '서울 합정동', images: ['https://i.pravatar.cc/300?img=13', 'https://i.pravatar.cc/300?img=14', 'https://i.pravatar.cc/300?img=15'], tags: ['자연스러운', '포토+영상', '인기'], originalPrice: 1200000, discountPercent: 45 },
];

function BusinessCard({ biz }: { biz: BusinessPartner }) {
  const [expanded, setExpanded] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPress = () => {
    pressTimer.current = setTimeout(() => setExpanded(true), 400);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const discountedPrice = biz.originalPrice * (1 - biz.discountPercent / 100);

  return (
    <Link
      href={`/businesses/${biz.id}`}
      className="flex gap-4 group"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onTouchStart={startPress}
      onTouchEnd={endPress}
    >
      {/* Left — Stacked square images that fan out */}
      <div className="relative w-[100px] h-[100px] shrink-0 my-2">
        <img
          src={biz.images[2]}
          alt=""
          className="absolute w-[100px] h-[100px] rounded-xl object-cover border-2 border-white shadow-sm z-[1] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={expanded ? { transform: 'translateX(60px) translateY(-6px) rotate(8deg) scale(0.88)' } : {}}
        />
        <img
          src={biz.images[1]}
          alt=""
          className="absolute w-[100px] h-[100px] rounded-xl object-cover border-2 border-white shadow-sm z-[2] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-[30ms]"
          style={expanded ? { transform: 'translateX(32px) translateY(-10px) rotate(4deg) scale(0.94)' } : {}}
        />
        <img
          src={biz.images[0]}
          alt={biz.name}
          className="absolute w-[100px] h-[100px] rounded-xl object-cover border-2 border-white shadow-md z-[3] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={expanded ? { transform: 'scale(1.03)' } : {}}
        />
      </div>

      {/* Right — Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
        {/* Category + Name */}
        <span className="text-[11px] font-medium text-primary-500">{biz.category}</span>
        <p className="text-[16px] font-bold text-gray-900 leading-tight mt-0.5 truncate">{biz.name}</p>

        {/* Location */}
        <div className="flex items-center gap-1 mt-1.5">
          <MapPin size={11} className="text-gray-400" />
          <span className="text-[12px] text-gray-400">{biz.location}</span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {biz.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
              {tag}
            </span>
          ))}
        </div>

        {/* Price + Coupon */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[11px] text-gray-400 line-through">{(biz.originalPrice / 10000).toFixed(0)}만원</span>
          <span className="text-[14px] font-black text-primary-500">{biz.discountPercent}%</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Gift size={11} className="text-primary-400" />
          <span className="text-[10px] text-primary-500 font-medium">회원가입 + 설문 답변 시 {biz.discountPercent}% 할인 쿠폰 증정</span>
        </div>
      </div>
    </Link>
  );
}

const HERO_CATEGORIES = [
  { name: 'MC·사회자', emoji: '🎤', badge: '인기' },
  { name: '축가', emoji: '🎵' },
  { name: '연주', emoji: '🎹' },
  { name: '쇼호스트', emoji: '📺' },
  { name: '웨딩홀', emoji: '💒', badge: '업종별' },
  { name: '스튜디오', emoji: '📷', badge: '업종별' },
  { name: '드레스', emoji: '👗' },
  { name: '헤어·메이크업', emoji: '💄' },
  { name: 'AI 매칭', emoji: '✨', badge: 'Best' },
  { name: '전체보기', emoji: '⊞' },
];

const BANNERS = [
  { id: 'b1', title: '당신의 특별한 날,\n완벽한 전문가를 만나세요', subtitle: 'Wedding Professionals', bgColor: 'bg-gradient-to-br from-primary-500 via-primary-500 to-primary-600' },
  { id: 'b2', title: '지금 견적 요청하면\n최대 30% 할인', subtitle: 'Special Offer', bgColor: 'bg-gradient-to-br from-violet-500 via-violet-500 to-purple-600' },
  { id: 'b3', title: 'AI가 추천하는\n나에게 딱 맞는 전문가', subtitle: 'AI Matching', bgColor: 'bg-gradient-to-br from-rose-400 via-pink-500 to-rose-600' },
  { id: 'b4', title: '후기 작성하고\n푸딩 포인트 받아가세요', subtitle: 'Review Event', bgColor: 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600' },
];

const CATEGORIES = ['전체', 'MC', '가수', '쇼호스트'];
const EVENTS = ['결혼식', '돌잔치', '생신잔치', '기업행사', '강의/클래스'];


function ProCard({ pro, favorites, toggleFavorite, index }: {
  pro: typeof MOCK_PROS[0];
  favorites: Set<string>;
  toggleFavorite: (e: React.MouseEvent, id: string) => void;
  index: number;
}) {
  return (
    <Link
      href={`/pros/${pro.id}`}
      className="block opacity-0 animate-fade-in group"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
    >
      <div className="relative rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_0.5fr] gap-[2px] h-[200px] lg:h-[220px]">
          <img src={pro.images[0]} alt={pro.name} className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
          <div className="grid grid-rows-2 gap-[2px]">
            <img src={pro.images[1]} alt="" className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
            <img src={pro.images[2]} alt="" className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
          </div>
        </div>
        <button
          onClick={(e) => toggleFavorite(e, pro.id)}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full transition-transform duration-200 active:scale-125"
        >
          <Heart
            size={22}
            className={favorites.has(pro.id) ? 'fill-red-500 text-red-500 drop-shadow-sm' : 'fill-black/30 text-white drop-shadow-sm'}
            strokeWidth={1.5}
          />
        </button>
      </div>
      <div className="mt-3">
        <span className="inline-block bg-gray-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded mb-2">Partners</span>
        <h4 className="text-[17px] font-extrabold text-gray-900 mb-1 lg:text-[18px]">{pro.role} {pro.name}</h4>
        <div className="flex items-center gap-1 mb-2.5">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
          <span className="text-[14px] font-bold text-gray-900">{pro.rating}</span>
          <span className="text-[13px] text-gray-400">({pro.reviews})</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-200">경력{pro.experience}년</span>
          {pro.tags.map((tag) => (
            <span key={tag} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{tag}</span>
          ))}
          {pro.available && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">즉시출근</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const rankScrollRef = useRef<HTMLDivElement>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedBizCat, setSelectedBizCat] = useState<string | null>(null);

  const filteredBiz = MOCK_BUSINESSES.filter((b) => !selectedBizCat || b.category === selectedBizCat);

  const toggleFavorite = (e: React.MouseEvent, proId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(proId)) next.delete(proId);
      else next.add(proId);
      return next;
    });
  };

  const languagePros = MOCK_PROS.filter((p) => {
    if (!LANGUAGE_PROS_IDS.includes(p.id)) return false;
    if (!selectedLang) return true;
    return PRO_LANGUAGES[p.id]?.includes(selectedLang);
  });

  const eventPros = MOCK_PROS.filter((p) => {
    if (!EVENT_SPECIALIST_IDS.includes(p.id)) return false;
    if (!selectedEventType) return true;
    return EVENT_SPECIALIST[p.id] === selectedEventType;
  });

  const onlinePros = MOCK_PROS.filter((p) => p.id in PRO_ONLINE_STATUS).slice(0, 20);

  return (
    <div className="bg-surface-50 min-h-screen">
      {/* ─── Mobile Header ───────────────────────────────────────────── */}
      <div className="lg:hidden glass sticky top-0 z-10 px-5 pt-12 pb-4 border-b border-gray-100/50">
        <div className="flex items-center justify-between mb-4">
          <Link href="/home"><Logo className="h-[22px] w-auto text-gray-900" /></Link>
          <Link href="/notifications" className="relative p-2.5 -mr-2 rounded-full hover:bg-surface-100/80" style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <Bell size={22} className="text-gray-700" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-white" />
          </Link>
        </div>
        <Link href="/pros" className="flex items-center gap-3 bg-surface-100 rounded-2xl px-4 py-3.5 group hover:bg-surface-200/80" style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <Search size={18} className="text-gray-400" />
          <span className="text-gray-400 text-[14px]">어떤 전문가를 찾고 계세요?</span>
        </Link>
      </div>

      {/* ─── Desktop Hero ────────────────────────────────────────────── */}
      <div className="hidden lg:block bg-white border-b border-gray-100/50">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="flex items-center justify-between gap-16">
            <div className="flex-1 max-w-xl">
              <p className="eyebrow mb-4">WEDDING PROFESSIONALS</p>
              <h2 className="headline mb-5">
                당신의 특별한 날,<br />
                <span className="text-primary-500">완벽한 전문가</span>를 만나세요
              </h2>
              <p className="text-[16px] text-gray-500 mb-10 leading-relaxed max-w-[50ch]">
                웨딩 MC, 축가 가수, 쇼호스트까지<br />
                AI 매칭으로 딱 맞는 전문가를 추천받으세요
              </p>
              <div className="flex gap-3">
                <Link href="/match" className="btn-primary w-auto inline-flex items-center gap-2 px-8">
                  견적 요청하기 <ArrowRight size={18} />
                </Link>
                <Link href="/pros" className="btn-outline w-auto px-8">
                  전문가 둘러보기
                </Link>
              </div>
            </div>
            {/* Hero visual — Stack Banner */}
            <div className="flex-1 max-w-lg">
              <StackBanner banners={BANNERS} />
            </div>
          </div>

          {/* ─── Category Icons ─────────────────────────────────────── */}
          <div className="flex items-start justify-between mt-14 gap-2">
            {HERO_CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.name === '전체보기' ? '/pros' : `/pros?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-2 group w-[90px]"
              >
                <div className="relative">
                  {cat.badge && (
                    <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      cat.badge === 'Best'
                        ? 'bg-red-500 text-white'
                        : 'bg-white text-red-500 border border-red-400'
                    }`}>
                      {cat.badge}
                    </span>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-surface-50 flex items-center justify-center text-[28px] group-hover:bg-surface-100 group-hover:scale-105 transition-all duration-200">
                    {cat.emoji}
                  </div>
                </div>
                <span className="text-[13px] text-gray-700 font-medium text-center leading-tight group-hover:text-gray-900 transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-0 py-6 lg:py-12 space-y-10 lg:max-w-7xl lg:mx-auto lg:px-8">
        {/* ─── Category Chips ────────────────────────────────────────── */}
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
          {CATEGORIES.map((cat, i) => (
            <button key={cat} className={i === 0 ? 'chip-active' : 'chip-inactive'}>
              {cat}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 1. 지금 접속중인 전문가                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="section-title">지금 접속중인 전문가</h3>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              </div>
              <p className="section-subtitle mt-1">지금 바로 상담 가능한 전문가예요</p>
            </div>
          </div>
          <div className="flex gap-6 overflow-x-auto overflow-y-visible scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
            {onlinePros.map((pro) => (
              <div key={pro.id} className="shrink-0">
                <OnlineProCard pro={pro} />
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. 이달의 TOP 전문가                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="section-title">이달의 TOP 전문가</h3>
              <p className="section-subtitle mt-1">리뷰와 평점으로 선정된 TOP 5</p>
            </div>
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                onClick={() => rankScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => rankScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={18} className="text-gray-500" />
              </button>
            </div>
          </div>

          <div
            ref={rankScrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0 snap-x snap-mandatory"
          >
            {MOCK_PROS.slice(0, 5).map((pro, i) => (
              <Link
                key={pro.id}
                href={`/pros/${pro.id}`}
                className="flex-shrink-0 w-[260px] lg:w-[280px] snap-start flex gap-3 group"
              >
                {/* Rank Number — vertically centered */}
                <div className="flex items-center shrink-0">
                  <span className="text-[36px] font-black text-gray-900 leading-none">{i + 1}</span>
                </div>

                {/* Photo 3:4 */}
                <div className="w-[80px] h-[106px] rounded-lg overflow-hidden shrink-0">
                  <img
                    src={pro.image}
                    alt={pro.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <span className="text-[11px] font-medium text-gray-400">{pro.category}</span>
                    <p className="text-[15px] font-bold text-gray-900 leading-tight">{pro.name}</p>
                  </div>
                  <RotatingReview proId={pro.id} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. 인기 전문가 — PC 5×2, Mobile 2×3                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="section-title">인기 전문가</h3>
              <p className="section-subtitle mt-1">고객 만족도가 높은 전문가를 만나보세요</p>
            </div>
            <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
              전체보기 <ChevronRight size={16} />
            </Link>
          </div>
          {/* Mobile: 2×3 = 6 items, Desktop: 5×2 = 10 items */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-5 lg:gap-x-5 lg:gap-y-10">
            {MOCK_PROS.slice(0, 10).map((pro, i) => (
              <div key={pro.id} className={i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. 행사 전문가                                              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">행사 전문가</h3>
                <p className="section-subtitle mt-1">행사 유형별 전문 사회자를 만나보세요</p>
              </div>
              <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
              <button
                onClick={() => setSelectedEventType(null)}
                className={selectedEventType === null ? 'chip-active' : 'chip-inactive'}
              >
                전체
              </button>
              {ALL_EVENT_TYPES.map((et) => (
                <button
                  key={et}
                  onClick={() => setSelectedEventType(selectedEventType === et ? null : et)}
                  className={selectedEventType === et ? 'chip-active' : 'chip-inactive'}
                >
                  {et}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-5 lg:gap-x-5 lg:gap-y-10">
            {eventPros.slice(0, 10).map((pro, i) => (
              <div key={pro.id} className={i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
              </div>
            ))}
          </div>
          {eventPros.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 행사 유형의 전문가가 없습니다</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 5. 외국어 전문가                                            */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">외국어 전문가</h3>
                <p className="section-subtitle mt-1">외국어 가능 전문가와 함께하세요</p>
              </div>
              <Link href="/pros" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
              <button
                onClick={() => setSelectedLang(null)}
                className={selectedLang === null ? 'chip-active' : 'chip-inactive'}
              >
                전체
              </button>
              {ALL_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(selectedLang === lang ? null : lang)}
                  className={selectedLang === lang ? 'chip-active' : 'chip-inactive'}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-5 lg:gap-x-5 lg:gap-y-10">
            {languagePros.slice(0, 10).map((pro, i) => (
              <div key={pro.id} className={i >= 6 ? 'hidden lg:block' : ''}>
                <ProCard pro={pro} favorites={favorites} toggleFavorite={toggleFavorite} index={i} />
              </div>
            ))}
          </div>
          {languagePros.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 언어의 전문가가 없습니다</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 6. 기업회원 컨텐츠                                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section>
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">웨딩 파트너</h3>
                <p className="section-subtitle mt-1">프리티풀이 엄선한 웨딩 업체를 만나보세요</p>
              </div>
              <Link href="/businesses" className="text-[13px] text-primary-500 font-semibold flex items-center gap-0.5 hover:text-primary-600" style={{ transition: 'color 0.3s' }}>
                전체보기 <ChevronRight size={16} />
              </Link>
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0">
              <button
                onClick={() => setSelectedBizCat(null)}
                className={selectedBizCat === null ? 'chip-active' : 'chip-inactive'}
              >
                전체
              </button>
              {BIZ_CATEGORIES.slice(1).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedBizCat(selectedBizCat === cat ? null : cat)}
                  className={selectedBizCat === cat ? 'chip-active' : 'chip-inactive'}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Coupon Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Gift size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">회원가입 후 설문조사 답변하면</p>
              <p className="text-[12px] text-white/70 mt-0.5">최대 50% 할인 쿠폰을 바로 드려요</p>
            </div>
            <Link href="/signup" className="ml-auto shrink-0 text-[12px] font-bold text-primary-600 bg-white px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
              쿠폰 받기
            </Link>
          </div>

          {/* Business Cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            {filteredBiz.slice(0, 8).map((biz) => (
              <BusinessCard key={biz.id} biz={biz} />
            ))}
          </div>
          {filteredBiz.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-10">해당 카테고리의 업체가 없습니다</p>
          )}
        </section>
      </div>
    </div>
  );
}
