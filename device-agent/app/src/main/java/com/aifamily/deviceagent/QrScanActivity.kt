package com.aifamily.deviceagent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.aifamily.deviceagent.databinding.ActivityQrScanBinding
import com.aifamily.deviceagent.security.EnrollmentQr
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * صفحه اسکن کد QR اتصال دستگاه — جایگزین اختیاری ورودی دستی در EnrollmentActivity.
 * از CameraX برای پیش‌نمایش/دریافت فریم و ML Kit Barcode Scanning (کاملاً On-Device) برای
 * تشخیص QR استفاده می‌کند. منطق تفسیر محتوای اسکن‌شده در [EnrollmentQr] (پورت Kotlin خالص، بدون
 * android.*) نگه‌داری می‌شود تا قابل تست واحد باشد؛ این Activity فقط آن را فراخوانی می‌کند.
 *
 * نتیجه با [RESULT_API_BASE_URL]/[RESULT_DEVICE_TOKEN] در Intent نتیجه به EnrollmentActivity
 * بازگردانده می‌شود (الگوی ActivityResultLauncher، نه startActivityForResult منسوخ).
 */
class QrScanActivity : AppCompatActivity() {

    companion object {
        const val RESULT_API_BASE_URL = "apiBaseUrl"
        const val RESULT_DEVICE_TOKEN = "deviceToken"
    }

    private lateinit var binding: ActivityQrScanBinding
    private lateinit var cameraExecutor: ExecutorService
    private val hasHandledResult = AtomicBoolean(false)

    private val requestCameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                startCamera()
            } else {
                showPermissionDenied()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityQrScanBinding.inflate(layoutInflater)
        setContentView(binding.root)
        cameraExecutor = Executors.newSingleThreadExecutor()

        if (hasCameraPermission()) {
            startCamera()
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun showPermissionDenied() {
        binding.permissionMessageText.text = getString(R.string.camera_permission_denied)
        binding.permissionMessageText.visibility = android.view.View.VISIBLE
        binding.cameraPreview.visibility = android.view.View.GONE
        binding.instructionsText.visibility = android.view.View.GONE
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = androidx.camera.core.Preview.Builder().build().also {
                it.setSurfaceProvider(binding.cameraPreview.surfaceProvider)
            }

            val scannerOptions = BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
            val scanner = BarcodeScanning.getClient(scannerOptions)

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also { analysis ->
                    analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                        processFrame(imageProxy, scanner)
                    }
                }

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalysis,
                )
            } catch (_: Exception) {
                // در دستگاه‌های بدون دوربین پشت یا در حال استفاده توسط اپ دیگر — کاربر می‌تواند
                // با دکمه برگشت، به ورودی دستی برگردد.
                showPermissionDenied()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun processFrame(imageProxy: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        scanner.process(inputImage)
            .addOnSuccessListener { barcodes -> handleBarcodes(barcodes) }
            .addOnCompleteListener { imageProxy.close() }
    }

    private fun handleBarcodes(barcodes: List<Barcode>) {
        if (hasHandledResult.get()) return

        for (barcode in barcodes) {
            val payload = EnrollmentQr.parse(barcode.rawValue) ?: continue
            if (hasHandledResult.compareAndSet(false, true)) {
                val resultIntent = Intent().apply {
                    putExtra(RESULT_API_BASE_URL, payload.apiBaseUrl)
                    putExtra(RESULT_DEVICE_TOKEN, payload.deviceToken)
                }
                setResult(RESULT_OK, resultIntent)
                finish()
            }
            return
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
