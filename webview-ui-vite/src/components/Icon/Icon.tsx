import React from "react";
import { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  // Add any additional props here if needed
}

const Icon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="1em" height="1em" fill="none" {...props}>
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M0 250c0 138.071 111.929 250 250 250s250-111.929 250-250S388.071 0 250 0 0 111.929 0 250ZM166.926 66.462c5.011 2.591 7.473 12.226 4.964 19.424-1.108 3.178-.424 7.949 2.087 14.554a2.65 2.65 0 0 0 3.538 1.486l1.218-.533c7.462-3.265 24.797-8.436 35.673-10.642 9.691-1.966 14.065-2.245 34.594-2.206 17.757.033 25.699.459 32.5 1.742 17.955 3.388 34.995 9.021 46.138 15.253 3.403 1.903 6.589 3.46 7.08 3.46.491 0 1.82-3.713 2.954-8.25 1.796-7.195 1.885-8.595.694-10.95-4.028-7.963 1.979-19.8 10.046-19.8C354.519 70 359 75.531 359 83.068c0 3.563-.605 4.766-4.171 8.3-3.703 3.668-4.48 5.303-6.917 14.549-1.697 6.441.218 13.33 4.968 18 9.192 9.037 15.395 17.554 21.179 29.083 2.346 4.675 5.204 9.145 6.353 9.933 1.148.789 3.934 3.264 6.19 5.5 6.067 6.016 8.52 13.418 9.136 27.567.869 19.969-3.33 34.682-12.241 42.896-2.453 2.261-5.32 5.797-6.372 7.858-1.052 2.06-2.86 4.603-4.019 5.651-2.81 2.542-2.692 3.204 1.369 7.699 4.379 4.847 9.853 15.643 12.16 23.983 1.297 4.688 1.76 9.909 1.722 19.413-.044 11.164-.434 14.271-2.763 22-1.492 4.95-4.41 12.157-6.485 16.016-1.943 3.612-.114 8.132 3.809 9.329 11.383 3.474 25.317 10.409 30.484 15.171 8.933 8.234 8.602 16.124-1.046 24.942-16.068 14.685-57.442 26.045-109.306 30.013-17.539 1.342-81.342 1.325-97.746-.025-61.172-5.037-111.28-21.785-116.41-38.907-3.668-12.242 6.855-21.492 35.914-31.567.95-.329.612-1.366-1.233-3.785-3.987-5.227-9.384-17.764-11.567-26.869-2.479-10.34-2.691-26.774-.456-35.358 2.105-8.09 7.521-19.052 11.971-24.232l.39-.454a5.713 5.713 0 0 0-.095-7.553c-1.856-2.055-3.979-5.195-4.717-6.978-.739-1.784-1.917-3.243-2.619-3.243-1.854 0-7.096-6.304-9.991-12.018-3.75-7.401-5.46-16.23-5.476-28.285-.027-19.363 4.207-30.52 14.054-37.036 3.453-2.285 5.488-4.649 7.447-8.652 3.928-8.026 12.47-20.661 18.388-27.2 4.686-5.178 17.784-16.416 21.661-18.586 1.414-.791 1.309-1.823-.985-9.736-2.125-7.331-3.163-9.344-6.048-11.722-11.649-9.601-1.701-29.075 11.394-22.303Zm-9.038 3.038c-1.437.78-3.203 2.845-3.925 4.589-1.797 4.339.355 10.606 4.593 13.377 2.522 1.649 3.483 3.473 5.5 10.441 1.344 4.643 2.894 8.573 3.444 8.734.55.16 1.798-.313 2.773-1.052 1.684-1.276 1.645-1.747-.787-9.445-2.427-7.681-2.473-8.234-.897-10.639 2.568-3.92 1.47-12.198-2.016-15.196-3.07-2.641-4.986-2.819-8.685-.809ZM343.4 76.4c-2.698 2.698-3.4 4.201-3.4 7.277 0 2.133.692 4.866 1.538 6.074 1.408 2.011 1.315 3.02-1.107 11.908-2.501 9.182-2.55 9.781-.891 10.994.965.706 2.064 1.092 2.443.858.378-.234 1.956-5.211 3.507-11.06 2.348-8.862 3.222-10.818 5.239-11.737 2.851-1.299 5.271-5.542 5.271-9.241 0-2.97-4.887-8.473-7.523-8.473-.922 0-3.207 1.53-5.077 3.4ZM231.5 91.647c-14.959 1.735-23.897 3.59-38.75 8.044-9.268 2.78-9.813 3.382-7.817 8.633 5.635 14.82 34.508 23.829 71.567 22.33 25.458-1.03 43.249-7.128 53.493-18.336 6.083-6.657 6.324-8.739 1.257-10.862-6.585-2.759-26.367-7.337-38.551-8.922-10.467-1.36-32.937-1.844-41.199-.887Zm-59.013 16.632c-10.05 5.293-18.009 11.433-27.041 20.859-8.913 9.301-11.314 12.522-17.32 23.237l-2.543 4.537a8.926 8.926 0 0 0-.198 8.357c2.004 4.01 2.114 5.695 2.089 32.231-.027 29.654-.888 37.829-4.502 42.739a4.871 4.871 0 0 0-.138 5.575l.724 1.094c3.207 4.846 7.475 7.849 18.442 12.972 15.371 7.181 42.865 14.387 66 17.299 15.657 1.97 61.953 1.713 79.059-.44 26.981-3.395 51.096-9.525 67.355-17.123 11.265-5.264 14.662-7.538 18.21-12.189a7.392 7.392 0 0 0 .913-7.402l-.335-.779c-5.204-12.099-5.639-64.2-.625-74.768 1.425-3.002 1.365-3.551-.959-8.808-6.135-13.872-17.872-28.249-31.118-38.118-6.749-5.028-19.435-12.552-21.164-12.552-.462 0-1.949 2.092-3.306 4.649-4.546 8.569-18.136 17.031-34.53 21.5-7.082 1.93-10.583 2.186-30.5 2.227-19.449.041-23.917-.25-32.951-2.149-18.823-3.955-33.408-13.265-35.994-22.977-.623-2.338-1.227-4.237-1.344-4.221-.116.016-3.817 1.929-8.224 4.25Zm-55.697 60.264c-7.057 7.057-9.943 25.887-6.755 44.067 2.49 14.2 4.996 17.617 9.421 12.843 4.617-4.982 5.855-13.176 5.31-35.132-.458-18.412-1.433-25.321-3.575-25.321-.472 0-2.452 1.595-4.401 3.543Zm258.205-1.031c-2.771 7.289-3.829 35.341-1.867 49.488.572 4.125 1.06 8.85 1.083 10.5.024 1.65.242 2.222.485 1.271.406-1.587.673-1.558 3.25.347 3.943 2.915 6.3 2.127 7.866-2.632 3.372-10.25 3.935-33.24 1.134-46.304-1.158-5.399-5.542-12.36-8.924-14.17-1.754-.939-2.18-.728-3.027 1.5ZM197 173.894c6.097 4.365 8.986 11.647 8.994 22.674.008 9.175-2.122 16.16-6.196 20.327-10.586 10.828-24.903 4.27-27.769-12.72-2.522-14.958 3.663-29.869 13.471-32.472 3.15-.837 8.766.233 11.5 2.191Zm116-.024c11.78 8.548 12.604 33.367 1.466 44.163-2.8 2.714-4.369 3.377-8.874 3.751-6.92.574-11.437-1.963-15.351-8.621-2.539-4.32-2.741-5.472-2.741-15.663 0-9.367.32-11.594 2.158-15 2.504-4.64 6.77-8.939 10.342-10.425 3.308-1.375 9.883-.467 13 1.795Zm-206.948 6.881c-1.536 4.491-2.479 28.967-1.351 35.087.544 2.953.811-1.038.837-12.5.024-10.617.51-18.446 1.316-21.189 1.586-5.4.948-6.512-.802-1.398Zm79.282-2.466c-6.408 3.594-10.163 14.607-7.199 21.113 1.704 3.739 3.722 3.967 6.719.758 3.579-3.831 8.146-13.037 8.146-16.42 0-2.53-3.015-6.783-4.75-6.701-.412.02-1.725.582-2.916 1.25Zm111.923.965c-3.033 3.837-1.642 7.75 2.755 7.75 3.865 0 6.666-3.865 5.024-6.933-1.252-2.34-6.167-2.856-7.779-.817Zm94.22 21.25c.013 10.113.319 16.028.699 13.5.896-5.964.892-22.477-.007-27.5-.405-2.269-.705 3.79-.692 14Zm-99.024-11.069c-1.96 2.991-1.315 5.569 1.393 5.569 2.56 0 4.381-2.372 3.981-5.185-.46-3.228-3.374-3.436-5.374-.384ZM180.362 205.5c-.317.825-.286 2.255.068 3.178.59 1.537.777 1.544 2.243.077 1.65-1.649 1.21-4.755-.673-4.755-.585 0-1.322.675-1.638 1.5Zm114.049.871c-.888 2.314-.106 4.795 1.898 6.022 2.441 1.495 4.911-1.616 3.764-4.741-.943-2.567-4.831-3.446-5.662-1.281Zm82.339 24.291c.688.278 1.25.903 1.25 1.39 0 .487-.721.609-1.601.271-1.18-.453-1.506-.115-1.237 1.281.201 1.043.922 1.952 1.602 2.021 2.534.256 2.685.538.736 1.375-1.63.701-1.688.872-.309.93 2.029.084 3.253-1.538 1.825-2.42-1.915-1.184-1.105-2.628.879-1.566 1.45.776 2.213.608 3.25-.715 1.183-1.51 1.16-1.578-.179-.536-.992.771-2.051.865-3 .265-.806-.51-1.016-.941-.466-.958.55-.017.325-.467-.5-1-.825-.533-1.95-.941-2.5-.906-.55.035-.437.291.25.568ZM216.107 235.5c14.978 16.249 47.351 16.018 62.224-.445 2.015-2.23 4.088-4.055 4.607-4.055 4.713 0-3.639 9.811-11.901 13.981-16.177 8.164-33.715 8.105-49.232-.165-5.6-2.985-11.805-9.562-11.805-12.513 0-2.361 1.901-1.366 6.107 3.197Zm-90.353 26.759c-1.909 2.333-4.696 6.659-6.192 9.614l-.722 1.426a5.526 5.526 0 0 0 1.415 6.76c1.878 1.547 5.138 5.317 7.246 8.377 2.107 3.06 3.92 5.564 4.028 5.564.107 0 .241-5.71.295-12.689.055-6.978.377-13.95.716-15.493.434-1.975.035-3.543-1.349-5.302a2.55 2.55 0 0 0-3.978-.039l-1.459 1.782Zm241.17-1.668c-.965 1.164-1.334 5.829-1.372 17.357l-.036 11.037c-.005 1.493 1.901 2.122 2.786.919 1.541-2.095 5.028-5.444 7.75-7.442 2.721-1.998 4.948-4.094 4.948-4.657 0-2.936-10.433-18.805-12.363-18.805-.216 0-.986.716-1.713 1.591Zm-232.455 14.977c-.411 5.49-.244 14.55.393 21.257 3.79 39.928 21.236 65.622 53.745 79.155 21.212 8.831 60.581 11.431 91.893 6.069 15.782-2.702 24.006-5.232 35.391-10.886 29.813-14.805 47.181-49.426 47.094-93.874-.022-10.812-.57-11.33-6.914-6.528-16.132 12.21-47.01 22.727-75.571 25.741-49.389 5.21-106.902-5.66-137.473-25.984-3.738-2.485-7.031-4.518-7.318-4.518-.287 0-.845 4.306-1.24 9.568Zm-20.481 12.491c-2.134 10.052-.865 26.615 2.895 37.79 7.418 22.049 21.142 36.755 45.617 48.88 26.511 13.135 61.707 18.657 103.651 16.262 55.14-3.147 91.719-19.604 109.125-49.094 7.546-12.785 11.616-32.473 9.753-47.172-1.083-8.538-1.992-12.725-2.762-12.725-.284 0-4.252 3.263-8.817 7.25-6.62 5.783-8.427 7.958-8.929 10.75-5.154 28.67-15.668 49.825-31.531 63.443-13.401 11.504-28.788 17.783-54.49 22.235-14.226 2.465-52.147 2.472-65.5.012-11.79-2.171-24.902-6.101-31.493-9.437-27.524-13.934-43.638-37.543-48.549-71.129a22.09 22.09 0 0 0-6.88-13.041l-2.538-2.342-3.806-3.512c-1.977-1.824-5.188-.801-5.746 1.83ZM122 285.5c1.866 1.925 3.617 3.5 3.892 3.5.275 0-1.026-1.575-2.892-3.5-1.866-1.925-3.617-3.5-3.892-3.5-.275 0 1.026 1.575 2.892 3.5Zm84 45.149c0 2.141 2.721 3.055 4.013 1.348l1.021-1.348 1.994-2.634a10.126 10.126 0 0 1 8.074-4.015h1.606c1.416 0 2.227 1.614 1.381 2.75-1.126 1.512-3.805 4.757-5.953 7.21a7.26 7.26 0 0 0-.314 9.179l2.338 3.071 2.723 3.577c1.305 1.714.066 4.179-2.088 4.156a10.54 10.54 0 0 1-8.411-4.338L211 347.703l-.824-1.133c-1.222-1.678-3.875-.885-3.974 1.189l-.085 1.793a4.67 4.67 0 0 1-4.665 4.448 4.452 4.452 0 0 1-4.452-4.452V328.5a4.5 4.5 0 0 1 9 0v2.149ZM273 339v11.5a3.5 3.5 0 0 1-3.5 3.5c-1.925 0-3.5-.423-3.5-.941 0-.517-1.238-.295-2.75.494-3.641 1.899-5.134 1.815-8.939-.505-3.572-2.178-5.582-7.441-4.64-12.151 1.123-5.618 8.137-10.141 12.284-7.921 2.915 1.56 3.045 1.39 3.045-3.976v-1a4 4 0 0 1 8 0v11Zm-34.065-6.363c5.014 1.003 9.065 5.711 9.065 10.536 0 8.224-7.187 13.2-15.739 10.897-5.19-1.397-8.27-5.406-8.239-10.724.027-4.619 2.256-7.738 6.978-9.765 4.146-1.78 3.901-1.751 7.935-.944Zm44.966 7.054c.245 7.555.513 8.309 2.958 8.309 3.086 0 4.141-2.216 4.141-8.7V337a4 4 0 0 1 8 0v13.5a3.5 3.5 0 0 1-3.5 3.5c-2.475 0-3.5-.448-3.5-1.53 0-1.23-.572-1.107-2.917.627-2.246 1.661-3.71 2.008-6.363 1.51-5.624-1.055-7.02-3.491-7.526-13.135l-.211-4.01a4.24 4.24 0 0 1 4.234-4.462 4.614 4.614 0 0 1 4.612 4.466l.072 2.225Zm-50.33-.12c-.864.865-1.571 2.633-1.571 3.929 0 2.073 2.266 5.5 3.637 5.5 2.192 0 4.363-2.47 4.363-4.964 0-2.758-2.172-6.036-4-6.036-.471 0-1.564.707-2.429 1.571Zm24.458 1.854c-1.144 3.009-.473 5.267 1.951 6.564 2.846 1.523 5.236-.958 4.849-5.033-.279-2.929-.749-3.504-3.079-3.772-2.176-.251-2.952.216-3.721 2.241Z"
      clipRule="evenodd"
    />
  </svg>
);

export default Icon;