import React, {useState, useEffect} from "react";
import Modal from "react-modal";
import {useForm} from "react-hook-form";
import {yupResolver} from "@hookform/resolvers/yup";
import * as Yup from "yup";
import Payment from "./payment";
import {useToast} from "../utils/toastContext";

const customStyles = {
  content: {
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    marginRight: "-50%",
    transform: "translate(-50%, -50%)",
    background: "#ffffff",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 16px 0 rgba(31, 38, 135, 0.70)",
    transition: "background-color 0.3s, box-shadow 0.3s",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(6px)",
    maxWidth: "20rem",
    border: "1px solid rgba(255, 255, 255, 0.18)",
  },
};

const validationSchema = Yup.object().shape({
  name: Yup.string().required("Name is required"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  file: Yup.mixed()
    .required("File is required")
    .test("fileType", "Please select a CSV file", (value) => {
      return value instanceof File && value.type === "text/csv";
    }),
  price: Yup.string().required("Price is required"),
  checkbox: Yup.boolean().oneOf([true], "Checkbox must be checked"),
});

interface Props {
  handleCloseModal: () => void;
  showModal: boolean;
}

const Form: React.FC<Props> = ({handleCloseModal, showModal}) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [price, setPrice] = useState<string>("");
  const [isSubmitDisabled, setIsSubmitDisabled] = useState<boolean>(true);
  const [file, setFile] = useState<File | null>(null);
  const [numLines, setNumLines] = useState(0);
  const [chk, setChk] = useState<boolean>(false);
  const {showToast} = useToast();

  const {
    register,
    handleSubmit,
    formState: {errors},
  } = useForm({
    resolver: yupResolver(validationSchema),
  });

  useEffect(() => {
    if (
      ((price === "100" && numLines < 200) ||
        (price === "200" && numLines < 600) ||
        (price === "300" && numLines < 2000)) &&
      name &&
      email
    ) {
      setIsSubmitDisabled(!(file && numLines > 0 && chk));
    } else {
      setIsSubmitDisabled(true);
    }
  }, [file, numLines, chk, price, name, email]);

  const handleOpenModal = () => {
    if (!isSubmitDisabled) {
      setShowPaymentModal(true);
    } else {
      showToast("Please fill all fields");
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
  };

  const handleFileChange = (event: any) => {
    const selectedFile = event.target.files[0];

    if (!selectedFile) {
      showToast("No file selected, do nothing.");
      return;
    }

    if (selectedFile.type === "text/csv") {
      setFile(selectedFile);
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const fileContent = e.target?.result;
        const lines = fileContent.split("\n");
        const headers = lines[0].split(",");

        if (headers.includes("company_name")) {
          setNumLines(lines.length);
        } else {
          event.target.value = "";
          showToast('File must have "company_name" column.');
        }
      };

      reader.readAsText(selectedFile);
    } else {
      event.target.value = "";
      showToast("Please select a CSV file.");
    }
  };

  const handlePriceChange = (event: any) => {
    setPrice(event.target.value);
  };

  const handleChangeChk = (event: any) => {
    setChk(event.target.checked);
  };

  const onSubmit = (data: any) => {
    // Handle form submission
    try {
      validationSchema.validate(data, {abortEarly: false});
      // Proceed with submission or display error messages
    } catch (error) {
      console.error("Validation failed:", error);
    }
  };
  return (
    <>
      <Modal
        style={customStyles}
        isOpen={showModal}
        onRequestClose={handleCloseModal}
      >
        <form className="mt-4 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <input type="hidden" name="remember" defaultValue="true" />
          <div className="rounded-md shadow-sm  -space-y-px">
            <div>
              <label className="text-gray-500 font-light mt-4 dark:text-gray-50">
                Name<span className="text-red-500 dark:text-gray-50">:</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="appearance-none rounded-none relative block
                  w-full px-3 py-2 border border-gray-300
                  placeholder-gray-500 text-gray-900 rounded-t-md
                  focus:outline-none focus:ring-indigo-500
                  focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Name"
              />
            </div>
            <p>{errors.name?.message}</p>
            <br />
            <div>
              <label className="text-gray-500 font-light mt-4 dark:text-gray-50">
                Email Adress
                <span className="text-red-500 dark:text-gray-50">:</span>
              </label>
              <input
                id="email-address"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block
                  w-full px-3 py-2 border border-gray-300
                  placeholder-gray-500 text-gray-900 rounded-t-md
                  focus:outline-none focus:ring-indigo-500
                  focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <p>{errors.email?.message}</p>
            <br />
            <div>
              <label className="text-gray-500 font-light mt-4 dark:text-gray-50">
                Choose File
                <span className="text-red-500 dark:text-gray-50">:</span>
              </label>
              <input
                id="file"
                name="file"
                type="file"
                autoComplete="price"
                onChange={handleFileChange}
                required
                className="appearance-none rounded-none hidden relative 
                  w-full px-3 py-2 border border-gray-300
                  placeholder-gray-500 text-gray-900 rounded-t-md
                  focus:outline-none focus:ring-indigo-500
                  focus:border-indigo-500 focus:z-10 sm:text-sm"
              />
              <label
                htmlFor="file"
                className="cursor-pointer block group relative 
              py-2 px-4 border-dashed border-2 text-sm font-medium bg-white
              rounded-md text-gray-600 border-gray-600 text-center
              focus:outline-none focus:ring-2 focus:ring-offset-2
              focus:ring-indigo-500"
              >
                {file ? file.name : "upload"}
              </label>
            </div>
            <p>{errors.file?.message}</p>
            <br></br>
            <div>
              <label className="text-gray-500 font-light mt-4 dark:text-gray-50">
                Price
                <span className="text-red-500 dark:text-gray-50">:</span>
              </label>
              <select
                id="price"
                onChange={handlePriceChange}
                value={price}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              >
                <option value="" disabled hidden>
                  Choose here
                </option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="300">300</option>
              </select>
            </div>

            <p>{errors.price?.message}</p>
          </div>
          <div className="flex items-start ">
            <input
              id="agree-checkbox"
              type="checkbox"
              required
              onChange={handleChangeChk}
              className="h-4 w-4 text-indigo-600 relative top-1 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label
              htmlFor="agree-checkbox"
              className="ml-2 text-sm text-gray-900"
            >
              Check “Yes” to confirm that the row they want cleaned in the csv
              is called “Company” - no variations or else it won’t run correctly
            </label>
          </div>
          <div>
            <button
              id="submit"
              type="submit"
              disabled={isSubmitDisabled}
              onClick={handleOpenModal}
              className={`w-full listCleanBtn
             text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 font-medium rounded-full text-sm px-5 py-2.5 mb-2
             dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700
              ${
                !isSubmitDisabled
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-75"
              }
              `}
            >
              {" "}
              Submit
            </button>
          </div>
        </form>
        <Payment
          amount={price}
          email={email}
          file={file}
          name={name}
          handleCloseModal={handleClosePaymentModal}
          showModal={showPaymentModal}
        />
      </Modal>
    </>
  );
};

export default Form;
