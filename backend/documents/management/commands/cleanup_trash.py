from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from documents.models import Document
from audit.models import AuditLog


class Command(BaseCommand):
    help = 'Permanently delete documents that have been in trash for more than the grace period'

    def add_arguments(self, parser):
        parser.add_argument(
            '--grace-period',
            type=int,
            default=30,
            help='Grace period in days (default: 30)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        grace_period_days = options['grace_period']
        dry_run = options['dry_run']
        
        # Calculate the cutoff date
        cutoff_date = timezone.now() - timedelta(days=grace_period_days)
        
        # Find documents deleted before the cutoff date
        expired_documents = Document.objects.deleted_only().filter(
            deleted_at__lt=cutoff_date
        )
        
        count = expired_documents.count()
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'DRY RUN: Would permanently delete {count} documents older than {grace_period_days} days'
                )
            )
            if count > 0:
                self.stdout.write('Documents that would be deleted:')
                for doc in expired_documents:
                    self.stdout.write(
                        f'  - {doc.title} (ID: {doc.id}, deleted: {doc.deleted_at})'
                    )
        else:
            if count == 0:
                self.stdout.write(
                    self.style.SUCCESS('No documents to permanently delete.')
                )
                return
            
            # Log the cleanup action for each document
            for doc in expired_documents:
                AuditLog.log_activity(
                    user=None,  # System action
                    action='permanent_delete',
                    resource_type='document',
                    resource_id=str(doc.id),
                    resource_name=doc.title,
                    details={
                        'reason': 'Grace period expired',
                        'grace_period_days': grace_period_days,
                        'deleted_at': doc.deleted_at.isoformat(),
                    },
                    request=None
                )
            
            # Permanently delete the documents
            expired_documents.delete()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully permanently deleted {count} documents older than {grace_period_days} days'
                )
            )
