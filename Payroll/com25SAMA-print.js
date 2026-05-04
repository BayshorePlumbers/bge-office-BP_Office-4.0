const COM25SAMA_PRINT_PAYLOAD_KEY = "com25SAMA_print_payload_v1";
const COM25SAMA_PRINT_RETURN_KEY = "com25SAMA_return_v1";
const COM25SAMA_DEFAULT_RETURN_URL = "com25SAMA.html";

(function () {
  let hasReturned = false;
  let printStarted = false;
  let returnWatchInstalled = false;
  let manualPrintAttempted = false;
  let autoPrintAttempted = false;
  let returnArmed = false;
  let forceReturnTimer = null;

  let printButtonUnlockTimer = null;

  function setPrintButtonBusy(button, busyText) {
    if (!button) return;
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }
    button.disabled = true;
    button.classList.add("is-busy");
    button.setAttribute("aria-disabled", "true");
    button.textContent = busyText;
  }

  function clearPrintButtonBusy(button) {
    if (!button) return;
    button.disabled = false;
    button.classList.remove("is-busy");
    button.setAttribute("aria-disabled", "false");
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
  }

  function setStatusMessage(html) {
    const el = document.getElementById("printPageStatus");
    if (!el) return;
    el.innerHTML = html;
  }

  function getReturnUrl() {
    return sessionStorage.getItem(COM25SAMA_PRINT_RETURN_KEY) || COM25SAMA_DEFAULT_RETURN_URL;
  }

  function cleanupPrintSession() {
    sessionStorage.removeItem(COM25SAMA_PRINT_PAYLOAD_KEY);
    sessionStorage.removeItem(COM25SAMA_PRINT_RETURN_KEY);
  }

  function clearForceReturnTimer() {
    if (forceReturnTimer) {
      clearTimeout(forceReturnTimer);
      forceReturnTimer = null;
    }
  }

  function returnToCalculator() {
    if (hasReturned) return;
    hasReturned = true;
    clearForceReturnTimer();
    cleanupPrintSession();
    window.location.replace(getReturnUrl());
  }

  function scheduleForceReturn(ms = 15000) {
    clearForceReturnTimer();
    forceReturnTimer = setTimeout(() => {
      if (!hasReturned) returnToCalculator();
    }, ms);
  }

  function armReturnWatch() {
    returnArmed = true;
    scheduleForceReturn(15000);
  }

  function setHelpMessage(html) {
    const el = document.getElementById("printHelpMessage");
    if (!el) return;
    el.innerHTML = html;
  }

  function isIOSLike() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    return /iPad|iPhone|iPod/.test(ua) ||
      (platform === "MacIntel" && maxTouchPoints > 1);
  }

  function waitForImageReady(img) {
    if (!img) return Promise.resolve();

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === "function") {
        return img.decode().catch(() => {});
      }
      return Promise.resolve();
    }

    return new Promise(resolve => {
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });

      setTimeout(finish, 1500);
    });
  }

  function waitForLayoutReady() {
    const root = document.getElementById("printRoot");
    if (!root) return Promise.resolve();

    const images = Array.from(root.querySelectorAll("img"));

    return Promise.all(images.map(waitForImageReady)).then(() => {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 100);
          });
        });
      });
    });
  }

  function installReturnListeners() {
    if (returnWatchInstalled) return;
    returnWatchInstalled = true;

    let sawHidden = false;

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("is-printing");
      if (!returnArmed) return;
      setTimeout(returnToCalculator, 150);
    });

    document.addEventListener("visibilitychange", () => {
      if (!returnArmed) return;

      if (document.hidden) {
        sawHidden = true;
        return;
      }

      document.body.classList.remove("is-printing");

      if (sawHidden) {
        setTimeout(returnToCalculator, 300);
      }
    });

    window.addEventListener("pagehide", () => {
      if (!returnArmed) return;
      sawHidden = true;
      scheduleForceReturn(15000);
    });

    window.addEventListener("pageshow", () => {
      document.body.classList.remove("is-printing");
      if (!returnArmed) return;
      if (sawHidden) {
        setTimeout(returnToCalculator, 300);
      }
    });

    setTimeout(() => {
      if (returnArmed && !hasReturned) {
        returnToCalculator();
      }
    }, 120000);
  }

  function renderPayload() {
    const payload = sessionStorage.getItem(COM25SAMA_PRINT_PAYLOAD_KEY);
    const sheet = document.getElementById("printSheet");

    if (!sheet) return false;

    if (!payload) {
      sheet.innerHTML = `
        <div class="print-empty-state">
          <h2>Print data not found</h2>
          <p>Please go back to the calculator and generate the print page again.</p>
        </div>
      `;
      setStatusMessage("Print data not found.");
      setHelpMessage('Tap <strong>Go Back to Calculator</strong> and try again.');
      return true;
    }

    sheet.innerHTML = payload;
    return true;
  }

  window.addEventListener("beforeprint", () => {
    document.body.classList.add("is-printing");
  });

  window.addEventListener("afterprint", () => {
    document.body.classList.remove("is-printing");
  });

  function startPrint({ manual = false } = {}) {
    if (printStarted) return;

    const printBtn = document.getElementById("printNowButton");

    if (manual) {
      manualPrintAttempted = true;
      setPrintButtonBusy(printBtn, "Opening...");
    } else {
      autoPrintAttempted = true;
    }

    waitForLayoutReady()
      .then(() => {
        printStarted = true;
        armReturnWatch();

        document.body.classList.add("is-printing");

        if (printButtonUnlockTimer) {
          clearTimeout(printButtonUnlockTimer);
        }

        printButtonUnlockTimer = setTimeout(() => {
          if (!hasReturned) {
            clearPrintButtonBusy(printBtn);
          }
        }, 2500);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              try {
                window.print();
                setTimeout(() => {
                  installReturnListeners();
                }, 1500);
              } catch (_) {
                document.body.classList.remove("is-printing");
                printStarted = false;
                clearPrintButtonBusy(printBtn);
                setHelpMessage(
                  'Print preview could not be opened. Use <strong>Share → Print</strong>, or tap <strong>Go Back to Calculator</strong>.'
                );
              }
            }, 120);
          });
        });
      })
      .catch(() => {
        const printBtn = document.getElementById("printNowButton");
        clearPrintButtonBusy(printBtn);
        setHelpMessage(
          'The print page could not be prepared. Tap <strong>Go Back to Calculator</strong> and try again.'
        );
      });
  }

  function configureToolbar() {
    const printBtn = document.getElementById("printNowButton");
    const backBtn = document.getElementById("backToCalculatorButton");
    const subtitle = document.getElementById("printPageSubtitle");

    if (!printBtn || !subtitle || !backBtn) return;

    backBtn.textContent = "Go Back to Calculator";

    if (isIOSLike()) {
      printBtn.textContent = "Try Open Print Preview";
      subtitle.textContent = "Your final document is ready below.";
      setStatusMessage("Best results on iPhone/iPad: <strong>Share → Print</strong>.");
      setHelpMessage(
        'For the most reliable result on iPhone/iPad, use <strong>Share → Print</strong>. You can still try <strong>Try Open Print Preview</strong>. After printing or canceling, this page should return automatically.'
      );
    } else {
      printBtn.textContent = "Open Print Preview";
      subtitle.textContent = "Your final document is ready below.";
      setStatusMessage("Best results on desktop and Android: <strong>Open Print Preview</strong>.");
      setHelpMessage(
        'Use <strong>Open Print Preview</strong>. After printing or canceling, this page should return automatically.'
      );
    }
  }

  function maybeAutoPrint() {
    if (isIOSLike()) return;
    if (autoPrintAttempted || manualPrintAttempted || printStarted) return;
    startPrint({ manual: false });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const ok = renderPayload();
    if (!ok) return;

    configureToolbar();

    const printBtn = document.getElementById("printNowButton");
    const backBtn = document.getElementById("backToCalculatorButton");

    if (printBtn) {
      printBtn.addEventListener("click", function (event) {
        event.preventDefault();
        if (printBtn.disabled) return;
        startPrint({ manual: true });
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", function (event) {
        event.preventDefault();
        returnToCalculator();
      });
    }

    maybeAutoPrint();
  });
})();